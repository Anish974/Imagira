"""
Prepare BiRefNet-lite for the browser (spec 4.1-4.3).

Does not touch the Next.js app. Writes scripts/out/*.onnx, which you host on a
CDN — do NOT commit it or drop it in /public (4.2).

    python scripts/export_birefnet.py                 # verify + quantise the hub ONNX
    python scripts/export_birefnet.py --self-export   # also try exporting from PyTorch
    python scripts/export_birefnet.py --image test.jpg

WHY WE DO NOT EXPORT THIS OURSELVES
-----------------------------------
Exporting ZhengPeng7/BiRefNet_lite with torch.onnx works (see self_export below,
it needs a hand-written symbolic for torchvision::deform_conv2d and opset 19),
but the resulting graph is unloadable:

    NOT_IMPLEMENTED : Could not find an implementation for DeformConv(19)

onnxruntime ships no DeformConv kernel in any execution provider, so that graph
cannot run on CPU, WASM or WebGPU. onnx-community/BiRefNet_lite is the same MIT
weights re-exported with the deformable convs decomposed into primitive ops, and
it loads and runs. That is the one we ship.

License: MIT, base_model ZhengPeng7/BiRefNet_lite. Do not swap in BRIA RMBG-2.0 —
CC-BY-NC, not usable commercially.
"""

import argparse
import time
from pathlib import Path

try:
    # Python's bundled CA list misses locally-installed issuers (corporate proxy),
    # which makes the Hugging Face download fail with CERTIFICATE_VERIFY_FAILED.
    # This points verification at the OS trust store instead of disabling it.
    import truststore

    truststore.inject_into_ssl()
except ImportError:
    pass

import numpy as np
import onnx
import onnxruntime as ort

HUB_ID = "onnx-community/BiRefNet_lite"
TORCH_ID = "ZhengPeng7/BiRefNet_lite"
SIZE = 1024
TARGET_MB = 90
OUT_DIR = Path(__file__).parent / "out"

# 4.3 — the browser applies this normalisation before handing us the tensor.
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def mb(path: Path) -> float:
    return path.stat().st_size / 1024 / 1024


def make_input(image_path: str | None) -> np.ndarray:
    """Normalised NCHW float32 [1,3,1024,1024] — exactly what the browser will send."""
    from PIL import Image

    if image_path:
        img = Image.open(image_path).convert("RGB").resize((SIZE, SIZE), Image.BILINEAR)
        arr = np.asarray(img, dtype=np.float32) / 255.0
    else:
        # High-contrast shape on white. This has to be something the model is
        # CONFIDENT about: on ambiguous content every mask sits near 0.5, and
        # ordinary numerical noise flips it, which reads as a huge quality gap
        # that is really just a bad test image. Measured on a soft gradient blob,
        # fp32 ONNX "disagreed" with PyTorch on 24% of pixels; on this input the
        # same two graphs agree to a mean of 0.00003.
        yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
        arr = np.ones((SIZE, SIZE, 3), dtype=np.float32)
        circle = ((xx - SIZE / 2) ** 2 + (yy - SIZE * 0.45) ** 2) < (SIZE * 0.195) ** 2
        stem = (np.abs(xx - SIZE / 2) < SIZE * 0.06) & (yy > SIZE * 0.62) & (yy < SIZE * 0.88)
        arr[circle | stem] = 0.12

    arr = (arr - IMAGENET_MEAN) / IMAGENET_STD
    return np.ascontiguousarray(arr.transpose(2, 0, 1)[None], dtype=np.float32)


def graph_dims(value) -> list:
    return [d.dim_param or d.dim_value for d in value.type.tensor_type.shape.dim]


def check_contract(path: Path) -> bool:
    """Verify the graph matches spec 4.3 before anything gets wired into the browser."""
    model = onnx.load(str(path), load_external_data=False)
    inp, out = model.graph.input[0], model.graph.output[0]
    in_dims, out_dims = graph_dims(inp), graph_dims(out)
    float32 = onnx.TensorProto.FLOAT

    print(f"  input  {inp.name}: {in_dims} {onnx.TensorProto.DataType.Name(inp.type.tensor_type.elem_type)}")
    print(f"  output {out.name}: {out_dims} {onnx.TensorProto.DataType.Name(out.type.tensor_type.elem_type)}")

    ok = (
        in_dims[1:] == [3, SIZE, SIZE]
        and out_dims[1:] == [1, SIZE, SIZE]
        and inp.type.tensor_type.elem_type == float32
        and out.type.tensor_type.elem_type == float32
    )
    print(f"  contract 4.3: {'OK' if ok else 'MISMATCH — expected float32 [*,3,1024,1024] -> [*,1,1024,1024]'}")
    return ok


def sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x.astype(np.float32)))


def run_onnx(path: Path, x: np.ndarray, threads: int | None = None) -> tuple[np.ndarray, float]:
    options = ort.SessionOptions()
    options.log_severity_level = 3
    if threads:
        options.intra_op_num_threads = threads
    session = ort.InferenceSession(str(path), options, providers=["CPUExecutionProvider"])
    name = session.get_inputs()[0].name
    t0 = time.perf_counter()
    out = session.run(None, {name: x})[0]
    return sigmoid(out), time.perf_counter() - t0


def torch_reference(x: np.ndarray) -> np.ndarray:
    import torch
    from transformers import AutoModelForImageSegmentation

    print(f"Loading {TORCH_ID} for the reference mask ...")
    model = AutoModelForImageSegmentation.from_pretrained(TORCH_ID, trust_remote_code=True).eval()
    with torch.no_grad():
        out = model(torch.from_numpy(x))
    while isinstance(out, (list, tuple)):
        out = out[-1]
    return sigmoid(out.numpy())


def evaluate(label: str, path: Path, x: np.ndarray, reference: np.ndarray) -> None:
    if not check_contract(path):
        print(f"  skipping {label} — contract mismatch")
        return

    mask, multi = run_onnx(path, x)
    _, single = run_onnx(path, x, threads=1)
    diff = np.abs(mask - reference)
    # Fraction of pixels whose alpha moves by more than one 8-bit step. This is
    # what actually shows up in a cutout; a max over 1M pixels is one bad pixel.
    visible = float((diff > 1 / 255).mean())
    print(
        f"  size {mb(path):6.1f} MB | cpu {multi:6.2f}s | 1-thread {single:6.2f}s | "
        f"max diff {diff.max():.4f} | mean {diff.mean():.5f} | >1/255 in {visible * 100:.2f}% of px"
    )


def fetch(filename: str) -> Path:
    from huggingface_hub import hf_hub_download

    return Path(hf_hub_download(HUB_ID, filename))


def self_export(path: Path) -> None:
    """
    Kept for the record: this produces a valid ONNX file that no runtime can load.
    See the module docstring.
    """
    import torch
    import torch.nn as nn
    from torch.onnx import symbolic_helper
    from transformers import AutoModelForImageSegmentation

    class SingleOutput(nn.Module):
        def __init__(self, model):
            super().__init__()
            self.model = model

        def forward(self, x):
            out = self.model(x)
            while isinstance(out, (list, tuple)):
                out = out[-1]
            return out

    def deform_conv2d(
        g, input, weight, offset, mask, bias,
        stride_h, stride_w, pad_h, pad_w, dil_h, dil_w,
        n_weight_grps, n_offset_grps, use_mask,
    ):
        const = lambda v, name: symbolic_helper._get_const(v, "i", name)
        kernel_shape = symbolic_helper._get_tensor_sizes(weight)[2:]
        args = [input, weight, offset, bias]
        if const(use_mask, "use_mask"):
            args.append(mask)
        return g.op(
            "DeformConv", *args,
            dilations_i=[const(dil_h, "dil_h"), const(dil_w, "dil_w")],
            group_i=const(n_weight_grps, "n_weight_grps"),
            kernel_shape_i=kernel_shape,
            offset_group_i=const(n_offset_grps, "n_offset_grps"),
            pads_i=[const(pad_h, "pad_h"), const(pad_w, "pad_w")] * 2,
            strides_i=[const(stride_h, "stride_h"), const(stride_w, "stride_w")],
        )

    torch.onnx.register_custom_op_symbolic("torchvision::deform_conv2d", deform_conv2d, 19)

    # eval() must be set on the wrapper, not just the inner model: torch.onnx.export
    # restores whatever mode the module it was handed started in, and a fresh
    # wrapper starts in train mode, which makes BatchNorm blow up on the ASPP
    # global-pool branch (1x1 spatial).
    model = SingleOutput(AutoModelForImageSegmentation.from_pretrained(TORCH_ID, trust_remote_code=True)).eval()
    print("Exporting from PyTorch (opset 19, dynamic batch) ...")
    torch.onnx.export(
        model, torch.randn(1, 3, SIZE, SIZE), str(path),
        input_names=["input"], output_names=["output"],
        dynamic_axes={"input": {0: "batch"}, "output": {0: "batch"}},
        opset_version=19, do_constant_folding=True,
    )
    print(f"  wrote {path.name} ({mb(path):.1f} MB) — expect DeformConv to fail at load time")
    try:
        ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
        print("  it loaded. onnxruntime has gained a DeformConv kernel — reconsider using this.")
    except Exception as e:
        print(f"  as expected: {type(e).__name__}: {str(e).splitlines()[0][:140]}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", help="test image; a synthetic one is used if omitted")
    parser.add_argument("--self-export", action="store_true", help="also run the dead-end PyTorch export")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    if args.self_export:
        self_export(OUT_DIR / "birefnet-lite-selfexport.onnx")
        print()

    print(f"Fetching {HUB_ID} ...")
    fp32 = fetch("onnx/model.onnx")
    fp16 = fetch("onnx/model_fp16.onnx")

    x = make_input(args.image)
    print("\nPyTorch reference (this is what every diff below is measured against)")
    t0 = time.perf_counter()
    reference = torch_reference(x)
    print(f"  shape {reference.shape} | {time.perf_counter() - t0:.1f}s")

    print("\nfp32")
    evaluate("fp32", fp32, x, reference)

    print("\nfp16")
    evaluate("fp16", fp16, x, reference)

    int8 = OUT_DIR / "birefnet-lite-int8.onnx"
    if mb(fp16) > TARGET_MB:
        print(f"\nfp16 is {mb(fp16):.1f} MB, over the {TARGET_MB} MB target. Quantising to int8 ...")
        from onnxruntime.quantization import QuantType, quantize_dynamic

        if not int8.exists():
            quantize_dynamic(str(fp32), str(int8), weight_type=QuantType.QUInt8)
        print("\nint8")
        evaluate("int8", int8, x, reference)

    print(
        "\nCPU numbers above are not the browser. WebGPU is the target path (4.4) and the\n"
        "single-thread column is the closest proxy for the WASM fallback. Decide on size\n"
        "and quality here, then measure for real in the browser."
    )


if __name__ == "__main__":
    main()

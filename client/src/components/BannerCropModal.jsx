import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { Check, X } from "lucide-react";

function createImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, pixelCrop.width, pixelCrop.height
  );
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/webp", 0.9);
  });
}

export default function BannerCropModal({ imageSrc, isGif, onSave, onClose }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const onCropComplete = useCallback((_, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    if (isGif) {
      const { naturalWidth, naturalHeight } = await createImage(imageSrc);
      onSave({
        type: "gif",
        crop: JSON.stringify({
          x: croppedAreaPixels.x / naturalWidth,
          y: croppedAreaPixels.y / naturalHeight,
          width: croppedAreaPixels.width / naturalWidth,
          height: croppedAreaPixels.height / naturalHeight,
          zoom,
        }),
      });
    } else {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
      onSave({ type: "image", blob });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal crop-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div className="modal-header-row">
          <h2>Adjust Banner</h2>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ position: "relative", width: "100%", height: 300, background: "#000", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={4 / 1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.75rem" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Zoom:</span>
          <input type="range" min={1} max={3} step={0.1} value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{ flex: 1 }} />
        </div>
        <div className="modal-actions" style={{ marginTop: "0.75rem" }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>
            <Check size={16} /> Save Banner
          </button>
        </div>
      </div>
    </div>
  );
}

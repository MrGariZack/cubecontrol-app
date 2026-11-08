import type { PresetSlotId } from "@tonehub/cube-baby-protocol";
import { CUBE_BABY_KNOBS } from "../components/cube-baby/knobs";
import type { LiveParamsSnapshot } from "../types/device";

export const CLIP_FORMATS = {
  landscape: { width: 1280, height: 720 },
  portrait: { width: 720, height: 1280 },
} as const;

export type ClipFormat = keyof typeof CLIP_FORMATS;

const COLORS = {
  volume: "#cdd5df",
  cab: "#2ec4b6",
  delay: "#e6ba71",
  drive: "#ef8b7e",
};

function drawPedal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  params: LiveParamsSnapshot,
  activeSlot: PresetSlotId,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(width / 640, width / 640);
  const metal = ctx.createLinearGradient(0, 0, 0, 160);
  metal.addColorStop(0, "#1c222b");
  metal.addColorStop(1, "#0a0d11");
  ctx.fillStyle = metal;
  ctx.strokeStyle = "#47515d";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(0, 0, 640, 160, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#e7ebef";
  ctx.font = "700 13px system-ui";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText("CUBE BABY", 22, 20);
  ctx.textAlign = "right";
  ctx.fillStyle = "#a9b3c1";
  ctx.fillText("CubeControl", 618, 20);

  ctx.textAlign = "center";
  for (const [index, knob] of CUBE_BABY_KNOBS.entries()) {
    const cx = 42 + index * (556 / 9);
    const cy = 69;
    const enabled = (knob.section === undefined || params[knob.section] > 0)
      && (!knob.delayTimeCluster || params.mix > 0)
      && (!knob.bipolarCenterOff || (params.modulation !== 7 && params.modulation !== 8));
    const start = Math.PI * 0.75;
    const value = Math.min(1, Math.max(0, params[knob.param] / knob.max));
    const angle = start + Math.PI * 1.5 * value;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#3b4551";
    ctx.beginPath();
    ctx.arc(cx, cy, 19, start, start + Math.PI * 1.5);
    ctx.stroke();
    ctx.strokeStyle = enabled ? COLORS[knob.tone] : "#667180";
    ctx.beginPath();
    ctx.arc(cx, cy, 19, start, angle);
    ctx.stroke();
    ctx.fillStyle = "#303844";
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * 6, cy + Math.sin(angle) * 6);
    ctx.lineTo(cx + Math.cos(angle) * 12, cy + Math.sin(angle) * 12);
    ctx.stroke();
    ctx.fillStyle = "#d9dfe6";
    ctx.font = "700 10px system-ui";
    ctx.fillText(knob.label, cx, 99);
  }

  const switches = [
    { slot: "A", label: "IR / REV", enabled: params.irSection > 0, color: COLORS.cab },
    { slot: "B", label: "MOD / DLY", enabled: params.delaySection > 0, color: COLORS.delay },
    { slot: "C", label: "AMP / TONE", enabled: params.toneSection > 0, color: COLORS.drive },
  ] as const;
  for (const [index, item] of switches.entries()) {
    const left = 22 + index * 202;
    const active = item.slot === activeSlot;
    ctx.fillStyle = active ? "#25333b" : "#161b22";
    ctx.strokeStyle = active ? item.color : "#39434e";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(left, 116, 192, 29, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = item.enabled ? item.color : "#687586";
    ctx.beginPath();
    ctx.arc(left + 13, 130.5, 3, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = "#f1f4f7";
    ctx.font = "700 12px system-ui";
    ctx.fillText(item.slot, left + 32, 130.5);
    ctx.fillStyle = "#c1cad4";
    ctx.fillText(item.label, left + 111, 130.5);
  }
  ctx.restore();
}

export function drawClipFrame(
  ctx: CanvasRenderingContext2D,
  camera: HTMLVideoElement | null,
  format: ClipFormat,
  pedal: { params: LiveParamsSnapshot; slot: PresetSlotId } | null,
) {
  const { width, height } = CLIP_FORMATS[format];
  const pedalWidth = format === "portrait" ? width - 56 : 768;
  const pedalHeight = pedalWidth / 4;
  const cameraHeight = pedal ? height - pedalHeight - 27 : height;
  ctx.fillStyle = "#0c1016";
  ctx.fillRect(0, 0, width, height);
  if (camera && camera.readyState >= 2 && camera.videoWidth > 0 && camera.videoHeight > 0) {
    const scale = Math.max(width / camera.videoWidth, cameraHeight / camera.videoHeight);
    const sourceWidth = width / scale;
    const sourceHeight = cameraHeight / scale;
    ctx.drawImage(
      camera,
      (camera.videoWidth - sourceWidth) / 2, (camera.videoHeight - sourceHeight) / 2,
      sourceWidth, sourceHeight, 0, 0, width, cameraHeight,
    );
  }
  if (pedal) {
    drawPedal(ctx, (width - pedalWidth) / 2, height - pedalHeight - 14, pedalWidth, pedal.params, pedal.slot);
  }
}

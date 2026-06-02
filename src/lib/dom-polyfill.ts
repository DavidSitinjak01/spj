/**
 * Browser API Polyfills for Node.js Serverless Environments (Vercel)
 *
 * pdfjs-dist v6+ requires DOMMatrix, DOMPoint, and DOMRect which are
 * browser APIs not available in Node.js. This module provides minimal
 * stub implementations sufficient for PDF text extraction.
 *
 * This module MUST be imported before any pdfjs-dist import.
 * It is applied:
 * 1. Via instrumentation.ts at server startup
 * 2. Via pdf-processor.ts at module load time
 * 3. Via explicit calls in each extraction function
 */

let applied = false;

export function applyDOMPolyfills(): void {
  if (applied) return;
  applied = true;

  // ─── DOMMatrix ───────────────────────────────────────────────
  // pdfjs-dist uses DOMMatrix for coordinate transformations.
  // For text extraction only, a minimal identity-matrix stub is sufficient.
  if (typeof globalThis.DOMMatrix === 'undefined') {
    class DOMMatrixStub {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      m11 = 1; m12 = 0; m13 = 0; m14 = 0;
      m21 = 0; m22 = 1; m23 = 0; m24 = 0;
      m31 = 0; m32 = 0; m33 = 1; m34 = 0;
      m41 = 0; m42 = 0; m43 = 0; m44 = 1;
      is2D = true;
      isIdentity = true;
      constructor(_init?: string | number[]) {}
      static fromMatrix(): DOMMatrixStub { return new DOMMatrixStub(); }
      static fromFloat32Array(): DOMMatrixStub { return new DOMMatrixStub(); }
      static fromFloat64Array(): DOMMatrixStub { return new DOMMatrixStub(); }
      multiply(): DOMMatrixStub { return new DOMMatrixStub(); }
      multiplySelf(): DOMMatrixStub { return this; }
      preMultiplySelf(): DOMMatrixStub { return this; }
      translate(): DOMMatrixStub { return new DOMMatrixStub(); }
      translateSelf(): DOMMatrixStub { return this; }
      scale(): DOMMatrixStub { return new DOMMatrixStub(); }
      scale3d(): DOMMatrixStub { return new DOMMatrixStub(); }
      scaleSelf(): DOMMatrixStub { return this; }
      scale3dSelf(): DOMMatrixStub { return this; }
      rotate(): DOMMatrixStub { return new DOMMatrixStub(); }
      rotateSelf(): DOMMatrixStub { return this; }
      rotateFromVector(): DOMMatrixStub { return new DOMMatrixStub(); }
      rotateFromVectorSelf(): DOMMatrixStub { return this; }
      rotateAxisAngleSelf(): DOMMatrixStub { return this; }
      skewX(): DOMMatrixStub { return new DOMMatrixStub(); }
      skewXSelf(): DOMMatrixStub { return this; }
      skewY(): DOMMatrixStub { return new DOMMatrixStub(); }
      skewYSelf(): DOMMatrixStub { return this; }
      inverse(): DOMMatrixStub { return new DOMMatrixStub(); }
      invertSelf(): DOMMatrixStub { return this; }
      setMatrixValue(): DOMMatrixStub { return this; }
      transformPoint(): { x: number; y: number; z: number; w: number } { return { x: 0, y: 0, z: 0, w: 1 }; }
      toFloat32Array(): Float32Array { return new Float32Array(16); }
      toFloat64Array(): Float64Array { return new Float64Array(16); }
      toString(): string { return 'matrix(1, 0, 0, 1, 0, 0)'; }
    }
    (globalThis as any).DOMMatrix = DOMMatrixStub;
  }

  // ─── DOMPoint ────────────────────────────────────────────────
  if (typeof globalThis.DOMPoint === 'undefined') {
    class DOMPointStub {
      x: number; y: number; z: number; w: number;
      constructor(x = 0, y = 0, z = 0, w = 1) { this.x = x; this.y = y; this.z = z; this.w = w; }
      static fromPoint(): DOMPointStub { return new DOMPointStub(); }
      matrixTransform(): DOMPointStub { return new DOMPointStub(); }
      toJSON(): { x: number; y: number; z: number; w: number } { return { x: this.x, y: this.y, z: this.z, w: this.w }; }
    }
    (globalThis as any).DOMPoint = DOMPointStub;
  }

  // ─── DOMRect ─────────────────────────────────────────────────
  if (typeof globalThis.DOMRect === 'undefined') {
    class DOMRectStub {
      x = 0; y = 0; width = 0; height = 0;
      get top(): number { return this.y; }
      get right(): number { return this.x + this.width; }
      get bottom(): number { return this.y + this.height; }
      get left(): number { return this.x; }
      static fromRect(): DOMRectStub { return new DOMRectStub(); }
      toJSON(): Record<string, number> { return { x: this.x, y: this.y, width: this.width, height: this.height, top: this.top, right: this.right, bottom: this.bottom, left: this.left }; }
    }
    (globalThis as any).DOMRect = DOMRectStub;
  }
}

// Apply immediately when this module is imported
applyDOMPolyfills();

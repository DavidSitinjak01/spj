/**
 * Next.js Instrumentation Hook
 * This file runs once per serverless function invocation on Vercel,
 * BEFORE any other code. We use it to polyfill browser APIs that
 * pdfjs-dist requires (DOMMatrix, DOMPoint, DOMRect) since they
 * don't exist in Node.js serverless environments.
 */

export async function register() {
  // Polyfill DOMMatrix (required by pdfjs-dist v6+)
  if (typeof globalThis.DOMMatrix === 'undefined') {
    try {
      // Try to import the dommatrix polyfill package
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const dommatrixModule = require('dommatrix');
      globalThis.DOMMatrix = dommatrixModule.DOMMatrix || dommatrixModule.default || dommatrixModule;
    } catch {
      // Fallback: create a minimal DOMMatrix polyfill
      // pdfjs-dist uses DOMMatrix for matrix transformations during rendering.
      // For text extraction (which is all we need), a minimal stub is sufficient.
      class DOMMatrixPolyfill {
        a: number = 1; b: number = 0; c: number = 0; d: number = 1;
        e: number = 0; f: number = 0;
        m11: number = 1; m12: number = 0; m13: number = 0; m14: number = 0;
        m21: number = 0; m22: number = 1; m23: number = 0; m24: number = 0;
        m31: number = 0; m32: number = 0; m33: number = 1; m34: number = 0;
        m41: number = 0; m42: number = 0; m43: number = 0; m44: number = 1;
        is2D: boolean = true; isIdentity: boolean = true;
        constructor(_init?: string | number[]) {}
        static fromMatrix(_other?: any): DOMMatrixPolyfill { return new DOMMatrixPolyfill(); }
        static fromFloat32Array(_a32: Float32Array): DOMMatrixPolyfill { return new DOMMatrixPolyfill(); }
        static fromFloat64Array(_a64: Float64Array): DOMMatrixPolyfill { return new DOMMatrixPolyfill(); }
        multiply(_other?: any): DOMMatrixPolyfill { return new DOMMatrixPolyfill(); }
        multiplySelf(_other?: any): DOMMatrixPolyfill { return this; }
        preMultiplySelf(_other?: any): DOMMatrixPolyfill { return this; }
        translate(_tx: number, _ty?: number, _tz?: number): DOMMatrixPolyfill { return new DOMMatrixPolyfill(); }
        translateSelf(_tx: number, _ty?: number, _tz?: number): DOMMatrixPolyfill { return this; }
        scale(_sx?: number, _sy?: number, _sz?: number, _px?: number, _py?: number, _pz?: number): DOMMatrixPolyfill { return new DOMMatrixPolyfill(); }
        scale3d(_s?: number, _px?: number, _py?: number, _pz?: number): DOMMatrixPolyfill { return new DOMMatrixPolyfill(); }
        scaleSelf(_sx?: number, _sy?: number, _sz?: number, _px?: number, _py?: number, _pz?: number): DOMMatrixPolyfill { return this; }
        scale3dSelf(_s?: number, _px?: number, _py?: number, _pz?: number): DOMMatrixPolyfill { return this; }
        rotate(_rotX?: number, _rotY?: number, _rotZ?: number): DOMMatrixPolyfill { return new DOMMatrixPolyfill(); }
        rotateSelf(_rotX?: number, _rotY?: number, _rotZ?: number): DOMMatrixPolyfill { return this; }
        rotateFromVector(_x?: number, _y?: number): DOMMatrixPolyfill { return new DOMMatrixPolyfill(); }
        rotateFromVectorSelf(_x?: number, _y?: number): DOMMatrixPolyfill { return this; }
        rotateAxisAngleSelf(_x?: number, _y?: number, _z?: number, _angle?: number): DOMMatrixPolyfill { return this; }
        skewX(_sx?: number): DOMMatrixPolyfill { return new DOMMatrixPolyfill(); }
        skewXSelf(_sx?: number): DOMMatrixPolyfill { return this; }
        skewY(_sy?: number): DOMMatrixPolyfill { return new DOMMatrixPolyfill(); }
        skewYSelf(_sy?: number): DOMMatrixPolyfill { return this; }
        inverse(): DOMMatrixPolyfill { return new DOMMatrixPolyfill(); }
        invertSelf(): DOMMatrixPolyfill { return this; }
        setMatrixValue(_source: string): DOMMatrixPolyfill { return this; }
        transformPoint(_point?: any): any { return { x: 0, y: 0, z: 0, w: 1 }; }
        toFloat32Array(): Float32Array { return new Float32Array(16); }
        toFloat64Array(): Float64Array { return new Float64Array(16); }
        toString(): string { return 'matrix(1, 0, 0, 1, 0, 0)'; }
      }
      globalThis.DOMMatrix = DOMMatrixPolyfill as any;
    }
  }

  // Polyfill DOMPoint
  if (typeof globalThis.DOMPoint === 'undefined') {
    class DOMPointPolyfill {
      x: number; y: number; z: number; w: number;
      constructor(x = 0, y = 0, z = 0, w = 1) { this.x = x; this.y = y; this.z = z; this.w = w; }
      static fromPoint(_other?: any): DOMPointPolyfill { return new DOMPointPolyfill(); }
      matrixTransform(_matrix?: any): DOMPointPolyfill { return new DOMPointPolyfill(); }
      toJSON(): { x: number; y: number; z: number; w: number } { return { x: this.x, y: this.y, z: this.z, w: this.w }; }
    }
    globalThis.DOMPoint = DOMPointPolyfill as any;
  }

  // Polyfill DOMRect
  if (typeof globalThis.DOMRect === 'undefined') {
    class DOMRectPolyfill {
      x: number; y: number; width: number; height: number;
      constructor(x = 0, y = 0, width = 0, height = 0) { this.x = x; this.y = y; this.width = width; this.height = height; }
      get top(): number { return this.y; }
      get right(): number { return this.x + this.width; }
      get bottom(): number { return this.y + this.height; }
      get left(): number { return this.x; }
      static fromRect(_other?: any): DOMRectPolyfill { return new DOMRectPolyfill(); }
      toJSON(): { x: number; y: number; width: number; height: number; top: number; right: number; bottom: number; left: number } {
        return { x: this.x, y: this.y, width: this.width, height: this.height, top: this.top, right: this.right, bottom: this.bottom, left: this.left };
      }
    }
    globalThis.DOMRect = DOMRectPolyfill as any;
  }
}

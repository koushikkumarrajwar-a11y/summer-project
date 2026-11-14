// ==========================================================
// CANVAS CROPPER (2:3 Fixed Aspect Ratio for Book Covers)
// ==========================================================

export class CoverCropper {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.targetRatio = 2 / 3; // width : height
    this.croppedBlob = null;
  }

  loadImage(file) {
    return new Promise((resolve, reject) => {
      if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
        return reject(new Error('Only JPG, PNG, and WebP images are allowed.'));
      }
      if (file.size > 2 * 1024 * 1024) {
        return reject(new Error('Image must be under 2 MB in size.'));
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          this.cropAndRender(img);
          resolve(this.croppedBlob);
        };
        img.onerror = () => reject(new Error('Failed to load image into canvas.'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsDataURL(file);
    });
  }

  cropAndRender(img) {
    const targetWidth = 400;
    const targetHeight = 600;

    this.canvas.width = targetWidth;
    this.canvas.height = targetHeight;

    const sourceRatio = img.width / img.height;
    let sWidth, sHeight, sx, sy;

    if (sourceRatio > this.targetRatio) {
      // Source is wider: crop sides
      sHeight = img.height;
      sWidth = img.height * this.targetRatio;
      sx = (img.width - sWidth) / 2;
      sy = 0;
    } else {
      // Source is taller: crop top & bottom
      sWidth = img.width;
      sHeight = img.width / this.targetRatio;
      sx = 0;
      sy = (img.height - sHeight) / 2;
    }

    this.ctx.clearRect(0, 0, targetWidth, targetHeight);
    this.ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);

    this.canvas.toBlob(
      (blob) => {
        this.croppedBlob = blob;
      },
      'image/jpeg',
      0.9
    );
  }

  getBlob() {
    return new Promise((resolve) => {
      if (this.croppedBlob) return resolve(this.croppedBlob);
      this.canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
    });
  }
}

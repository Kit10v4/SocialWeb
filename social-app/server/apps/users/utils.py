import io

from django.core.files.uploadedfile import InMemoryUploadedFile
from PIL import Image


def resize_image(image_file, size=(400, 400)):
    """
    Resize an uploaded image to *size* (width, height), preserving aspect
    ratio via thumbnail().  Returns a new InMemoryUploadedFile ready for
    saving on the model field (works with Cloudinary storage).
    """
    img = Image.open(image_file)

    # Convert palette / RGBA images so JPEG save won't fail
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    img.thumbnail(size, Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    buf.seek(0)

    return InMemoryUploadedFile(
        file=buf,
        field_name=image_file.name,
        name=image_file.name.rsplit(".", 1)[0] + ".jpg",
        content_type="image/jpeg",
        size=buf.getbuffer().nbytes,
        charset=None,
    )

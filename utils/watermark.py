import os
from PIL import Image, ImageDraw, ImageFont

def add_watermark(image_path, output_path, text="Okami Bot 🐺", font_path=None, font_size=40, opacity=128, position=(10, 10)):
    """
    يضيف علامة مائية نصية إلى الصورة.

    :param image_path: مسار الصورة الأصلية.
    :param output_path: مسار حفظ الصورة بعد إضافة العلامة المائية.
    :param text: النص المراد إضافته كعلامة مائية.
    :param font_path: مسار ملف الخط (مثل .ttf). إذا كان None، سيتم استخدام الخط الافتراضي.
    :param font_size: حجم الخط.
    :param opacity: شفافية العلامة المائية (0-255).
    :param position: موضع العلامة المائية (x, y).
    """
    try:
        img = Image.open(image_path).convert("RGBA")
        draw = ImageDraw.Draw(img)

        # تحميل الخط
        try:
            font = ImageFont.truetype(font_path, font_size) if font_path else ImageFont.load_default()
        except IOError:
            print(f"تحذير: لم يتم العثور على الخط في المسار {font_path}. استخدام الخط الافتراضي.")
            font = ImageFont.load_default()
            font_size = 20 # حجم افتراضي للخط الافتراضي

        # إنشاء طبقة للعلامة المائية
        watermark_layer = Image.new("RGBA", img.size, (255, 255, 255, 0))
        draw_watermark = ImageDraw.Draw(watermark_layer)

        # حساب حجم النص
        text_width, text_height = draw_watermark.textsize(text, font=font)

        # تحديد الموضع (يمكن تعديله ليكون في الزاوية السفلية اليمنى مثلاً)
        # هنا نضعها في الزاوية السفلية اليمنى مع هامش 10 بكسل
        x = img.width - text_width - 10
        y = img.height - text_height - 10

        # إضافة النص إلى طبقة العلامة المائية
        draw_watermark.text((x, y), text, font=font, fill=(0, 0, 0, opacity))

        # دمج الطبقات
        watermarked_img = Image.alpha_composite(img, watermark_layer)
        watermarked_img.save(output_path)
        return True
    except Exception as e:
        print(f"خطأ في إضافة العلامة المائية للصورة {image_path}: {e}")
        return False

# مثال للاستخدام (يمكن حذفه لاحقاً)
if __name__ == "__main__":
    # إنشاء صورة وهمية للاختبار
    dummy_image = Image.new("RGB", (800, 600), color = (73, 109, 137))
    draw = ImageDraw.Draw(dummy_image)
    draw.text((200, 250), "صورة اختبار", fill=(255,255,0))
    dummy_image.save("test_image.png")

    # إضافة علامة مائية
    add_watermark("test_image.png", "watermarked_test_image.png", text="Okami Bot 🐺", font_size=50, opacity=150)
    print("تم إنشاء test_image.png و watermarked_test_image.png")

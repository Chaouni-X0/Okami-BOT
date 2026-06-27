# -*- coding: utf-8 -*-

"""
utils/image_processor.py

يحتوي على دوال معالجة الصور لتناسب النشر على فيسبوك:
- تقسيم الصور الطويلة (المانهوا) إلى أجزاء مناسبة
- تحسين جودة الصور وضبط أبعادها
- ضغط الصور مع الحفاظ على أعلى جودة ممكنة

=== لماذا تقسيم الصور؟ ===
صور المانهوا عادة تكون طويلة جداً (أكثر من 10000 بكسل ارتفاع)
فيسبوك يضغط الصور الكبيرة بشكل سيء ويقلل جودتها
لذلك نقسمها إلى أجزاء بارتفاع مناسب (2048px كحد أقصى)
مع الحفاظ على أعلى جودة ممكنة.
"""

import os
from PIL import Image

# ═══════════════════════════════════════════════════════════════
# إعدادات فيسبوك للصور
# ═══════════════════════════════════════════════════════════════
FB_MAX_WIDTH = 2048          # أقصى عرض يدعمه فيسبوك بدون ضغط شديد
FB_MAX_HEIGHT = 2048         # أقصى ارتفاع مثالي لكل صورة
FB_OPTIMAL_WIDTH = 1200      # العرض المثالي لعرض جيد على فيسبوك
FB_MAX_FILE_SIZE_MB = 10     # أقصى حجم ملف (10 ميجابايت)
SPLIT_OVERLAP = 50           # تداخل بين الأجزاء المقسمة (بكسل) لتجنب القطع المفاجئ


def split_image_for_facebook(image_path, output_dir, max_height=FB_MAX_HEIGHT,
                              optimal_width=FB_OPTIMAL_WIDTH, page_index=1):
    """
    ✂️ يقسم صورة طويلة إلى أجزاء متعددة تناسب فيسبوك.
    
    المانهوا عادة تكون صور طويلة جداً (scroll-type).
    هذه الدالة تقسمها إلى أجزاء بارتفاع مناسب مع:
    - تداخل بسيط بين الأجزاء لتجنب القطع المفاجئ في النص/الرسم
    - الحفاظ على نسبة العرض إلى الارتفاع
    - ضبط العرض ليكون مثالياً لفيسبوك
    
    :param image_path: مسار الصورة الأصلية الطويلة
    :param output_dir: مجلد حفظ الأجزاء المقسمة
    :param max_height: أقصى ارتفاع لكل جزء
    :param optimal_width: العرض المثالي
    :param page_index: رقم الصفحة الأصلية (للتسمية)
    :return: قائمة بمسارات الأجزاء المقسمة
    """
    split_paths = []

    try:
        img = Image.open(image_path)
        original_width, original_height = img.size

        # ضبط العرض أولاً
        if original_width != optimal_width:
            ratio = optimal_width / original_width
            new_height = int(original_height * ratio)
            img = img.resize((optimal_width, new_height), Image.LANCZOS)
            original_width, original_height = img.size

        # حساب عدد الأجزاء المطلوبة
        effective_height = max_height - SPLIT_OVERLAP
        num_parts = (original_height + effective_height - 1) // effective_height

        print(f"      ✂️ تقسيم إلى {num_parts} أجزاء (الارتفاع الأصلي: {original_height}px)")

        for part_idx in range(num_parts):
            # حساب منطقة القص
            top = part_idx * effective_height
            bottom = min(top + max_height, original_height)

            # التأكد من أن الجزء الأخير ليس صغيراً جداً
            if part_idx == num_parts - 1 and (bottom - top) < 200:
                # دمج مع الجزء السابق
                if split_paths:
                    # نتجاهل هذا الجزء الصغير
                    break

            # قص الجزء
            cropped = img.crop((0, top, original_width, bottom))

            # حفظ الجزء
            part_filename = f"page_{page_index}_part_{part_idx + 1}.png"
            part_path = os.path.join(output_dir, part_filename)
            cropped.save(part_path, "PNG", quality=95)
            split_paths.append(part_path)

            cropped.close()

        img.close()

    except Exception as e:
        print(f"      ❌ خطأ في تقسيم الصورة: {e}")
        # في حالة الخطأ، نعيد الصورة الأصلية
        if not split_paths:
            split_paths.append(image_path)

    return split_paths


def optimize_image_quality(input_path, output_path, target_width=FB_OPTIMAL_WIDTH):
    """
    🎨 يحسن جودة الصورة وأبعادها لتناسب فيسبوك بأعلى جودة.
    
    خطوات التحسين:
    1. ضبط العرض ليكون مثالياً (1200px) مع الحفاظ على النسبة
    2. تحويل إلى RGB إذا كانت RGBA (فيسبوك لا يدعم الشفافية جيداً)
    3. حفظ بصيغة PNG بأعلى جودة
    4. إذا كان الحجم كبيراً جداً، نستخدم JPEG بجودة 95%
    
    :param input_path: مسار الصورة المدخلة
    :param output_path: مسار الصورة المحسنة
    :param target_width: العرض المستهدف
    """
    try:
        img = Image.open(input_path)
        original_width, original_height = img.size

        # ضبط العرض مع الحفاظ على النسبة
        if original_width != target_width and original_width > 0:
            ratio = target_width / original_width
            new_height = int(original_height * ratio)
            # استخدام LANCZOS للحصول على أفضل جودة عند التصغير/التكبير
            img = img.resize((target_width, new_height), Image.LANCZOS)

        # تحويل إلى RGB إذا كانت RGBA (فيسبوك يفضل RGB)
        if img.mode == 'RGBA':
            # إنشاء خلفية بيضاء
            background = Image.new('RGB', img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[3])  # استخدام قناة الشفافية كقناع
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')

        # حفظ بأعلى جودة
        # نجرب PNG أولاً (بدون فقدان)
        img.save(output_path, "PNG", optimize=True)

        # التحقق من حجم الملف
        file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
        if file_size_mb > FB_MAX_FILE_SIZE_MB:
            # إذا كان الحجم كبيراً جداً، نستخدم JPEG بجودة عالية
            jpeg_path = output_path.replace(".png", ".jpg")
            img.save(jpeg_path, "JPEG", quality=95, optimize=True)
            # استبدال PNG بـ JPEG
            os.remove(output_path)
            os.rename(jpeg_path, output_path)
            print(f"      📦 تم ضغط الصورة (كانت {file_size_mb:.1f}MB)")

        img.close()
        return True

    except Exception as e:
        print(f"      ❌ خطأ في تحسين الصورة: {e}")
        # في حالة الخطأ، ننسخ الصورة الأصلية
        if input_path != output_path:
            import shutil
            shutil.copy2(input_path, output_path)
        return False


def get_image_info(image_path):
    """
    📊 يعرض معلومات الصورة (للتشخيص).
    """
    try:
        img = Image.open(image_path)
        width, height = img.size
        mode = img.mode
        file_size = os.path.getsize(image_path) / 1024  # KB
        img.close()
        return {
            "width": width,
            "height": height,
            "mode": mode,
            "file_size_kb": round(file_size, 1),
            "needs_split": height > FB_MAX_HEIGHT,
            "needs_resize": width > FB_MAX_WIDTH
        }
    except Exception as e:
        return {"error": str(e)}


def batch_process_images(image_paths, output_dir, target_width=FB_OPTIMAL_WIDTH):
    """
    🔄 يعالج مجموعة من الصور دفعة واحدة.
    يقسم الصور الطويلة ويحسن جودة الباقي.
    
    :param image_paths: قائمة مسارات الصور
    :param output_dir: مجلد الإخراج
    :param target_width: العرض المستهدف
    :return: قائمة مسارات الصور المعالجة (مرتبة)
    """
    os.makedirs(output_dir, exist_ok=True)
    processed_paths = []

    for idx, img_path in enumerate(image_paths, 1):
        info = get_image_info(img_path)
        if "error" in info:
            print(f"   ⚠️ تخطي الصورة {idx}: {info['error']}")
            continue

        if info["needs_split"]:
            # تقسيم الصورة الطويلة
            parts = split_image_for_facebook(img_path, output_dir, page_index=idx)
            for part_path in parts:
                optimized_path = part_path.replace(".png", "_opt.png")
                optimize_image_quality(part_path, optimized_path, target_width)
                processed_paths.append(optimized_path)
                # حذف الجزء غير المحسن
                if os.path.exists(part_path) and part_path != optimized_path:
                    os.remove(part_path)
        else:
            # تحسين الصورة العادية
            output_filename = f"processed_{idx}.png"
            output_path = os.path.join(output_dir, output_filename)
            optimize_image_quality(img_path, output_path, target_width)
            processed_paths.append(output_path)

    return processed_paths

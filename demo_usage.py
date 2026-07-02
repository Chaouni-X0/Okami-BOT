from PIL import Image, ImageDraw, ImageFont
import os
import arabic_reshaper
from bidi.algorithm import get_display

# الإعدادات
TEMPLATE_DIR = "assets/templates"
OUTPUT_DIR = "assets/demo_output"
FONT_PATH = "assets/fonts/NotoSansArabic.ttf"
NEON_PURPLE = (191, 0, 255)
TEXT_WHITE = (255, 255, 255)

if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

def get_font(size):
    try:
        return ImageFont.truetype(FONT_PATH, size)
    except:
        return ImageFont.load_default()

def format_arabic(text):
    reshaped_text = arabic_reshaper.reshape(text)
    return get_display(reshaped_text)

def demo_comment():
    img = Image.open(f"{TEMPLATE_DIR}/top_comment.png").convert("RGBA")
    draw = ImageDraw.Draw(img)
    
    font_user = get_font(24)
    font_text = get_font(20)
    
    # النصوص الإنجليزية لا تحتاج لتشكيل
    draw.text((160, 42), "Chaouni-X0", font=font_user, fill=NEON_PURPLE)
    
    # النصوص العربية
    msg = format_arabic("هذا الفصل كان أسطورياً! بانتظار الفصل القادم 🐺🔥")
    # حساب العرض للنص العربي لوضعه بشكل صحيح (Pillow 10+ يستخدم getlength)
    draw.text((160, 95), msg, font=font_text, fill=TEXT_WHITE)
    
    img.save(f"{OUTPUT_DIR}/demo_comment.png")

def demo_reward():
    img = Image.open(f"{TEMPLATE_DIR}/points_reward.png").convert("RGBA")
    draw = ImageDraw.Draw(img)
    
    font_points = get_font(40)
    font_user = get_font(22)
    
    draw.text((250, 85), "+500 XP", font=font_points, fill=NEON_PURPLE)
    draw.text((220, 185), "User: Okami_Fan_2024", font=font_user, fill=TEXT_WHITE)
    
    img.save(f"{OUTPUT_DIR}/demo_reward.png")

def demo_leaderboard():
    img = Image.open(f"{TEMPLATE_DIR}/leaderboard.png").convert("RGBA")
    draw = ImageDraw.Draw(img)
    
    font_title = get_font(35)
    font_data = get_font(22)
    
    draw.text((200, 35), format_arabic("قائمة المتصدرين"), font=font_title, fill=NEON_PURPLE)
    
    users = [("Shadow Wolf", "15,400"), ("Luna", "12,200"), ("Zoro", "10,500")]
    for i, (name, pts) in enumerate(users):
        y = 150 + (i * 150)
        draw.text((170, y+35), format_arabic(f"الاسم: {name}"), font=font_data, fill=TEXT_WHITE)
        draw.text((170, y+75), format_arabic(f"النقاط: {pts}"), font=font_data, fill=NEON_PURPLE)
    
    img.save(f"{OUTPUT_DIR}/demo_leaderboard.png")

# تنفيذ العينات
demo_comment()
demo_reward()
demo_leaderboard()

print("Demo images updated with correct Arabic rendering in assets/demo_output/")

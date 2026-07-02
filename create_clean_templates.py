from PIL import Image, ImageDraw, ImageFilter
import os

# الإعدادات
BG_COLOR = (10, 10, 12)  # أسود داكن
NEON_PURPLE = (191, 0, 255)  # نيون أرجواني
TEMPLATE_DIR = "assets/templates"

if not os.path.exists(TEMPLATE_DIR):
    os.makedirs(TEMPLATE_DIR)

def create_glow_rect(draw, coords, color, width=2, glow_factor=3):
    # رسم مستطيل مع تأثير توهج بسيط
    for i in range(glow_factor, 0, -1):
        alpha_color = (*color, int(100/i))
        draw.rectangle([coords[0]-i, coords[1]-i, coords[2]+i, coords[3]+i], outline=color, width=width)

# 1. Profile Card Template (800x400)
def create_profile_template():
    img = Image.new('RGBA', (800, 400), color=(0,0,0,0))
    draw = ImageDraw.Draw(img)
    
    # الجسم الرئيسي للبطاقة مع شفافية بسيطة
    draw.rounded_rectangle([10, 10, 790, 390], radius=20, fill=(15, 15, 20, 230), outline=NEON_PURPLE, width=3)
    
    # إطار الصورة الشخصية (Avatar Frame)
    draw.ellipse([40, 80, 240, 280], outline=NEON_PURPLE, width=5)
    
    # منطقة المعلومات
    draw.line([280, 100, 750, 100], fill=NEON_PURPLE, width=2) # خط تحت الاسم
    
    img.save(f"{TEMPLATE_DIR}/base_profile.png")

# 2. Leaderboard Row Template (800x120) - قالب لسطر واحد في القائمة
def create_leaderboard_row_template():
    img = Image.new('RGBA', (800, 120), color=(0,0,0,0))
    draw = ImageDraw.Draw(img)
    
    draw.rounded_rectangle([5, 5, 795, 115], radius=10, fill=(20, 20, 25, 200), outline=(50, 50, 60, 255), width=2)
    
    # مكان الرتبة
    draw.ellipse([20, 20, 100, 100], outline=NEON_PURPLE, width=2)
    
    img.save(f"{TEMPLATE_DIR}/base_leaderboard_row.png")

# 3. Reward Notification (600x200)
def create_reward_template():
    img = Image.new('RGBA', (600, 200), color=(0,0,0,0))
    draw = ImageDraw.Draw(img)
    
    draw.rounded_rectangle([10, 10, 590, 190], radius=15, fill=(10, 10, 15, 250), outline=NEON_PURPLE, width=4)
    
    # أيقونة الجائزة (مثلث نيون)
    draw.polygon([(30, 100), (80, 40), (130, 100), (80, 160)], outline=NEON_PURPLE, width=3)
    
    img.save(f"{TEMPLATE_DIR}/base_reward.png")

# تشغيل
create_profile_template()
create_leaderboard_row_template()
create_reward_template()

print("Clean PNG base templates created successfully.")

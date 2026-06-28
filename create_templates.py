from PIL import Image, ImageDraw, ImageFont
import os

# الإعدادات العامة
BG_COLOR = (10, 10, 12)  # أسود مائل للأزرق الداكن
NEON_PURPLE = (191, 0, 255)  # نيون أرجواني
ACCENT_COLOR = (40, 40, 50)  # رمادي داكن للحدود
TEXT_WHITE = (240, 240, 240)
TEMPLATE_DIR = "assets/templates"
FONT_PATH = "assets/fonts/NotoSansArabic.ttf"

if not os.path.exists(TEMPLATE_DIR):
    os.makedirs(TEMPLATE_DIR)

def create_base_canvas(width, height):
    img = Image.new('RGB', (width, height), color=BG_COLOR)
    draw = ImageDraw.Draw(img)
    # رسم إطار نيون بسيط
    draw.rectangle([0, 0, width-1, height-1], outline=NEON_PURPLE, width=2)
    return img, draw

# 1. Top Comment Template (800x200)
def create_comment_template():
    img, draw = create_base_canvas(800, 200)
    # Placeholder for Avatar
    draw.ellipse([20, 40, 120, 140], outline=NEON_PURPLE, width=3)
    # Username Placeholder
    draw.rectangle([150, 40, 400, 70], fill=ACCENT_COLOR)
    # Comment Text Placeholder
    draw.rectangle([150, 90, 750, 160], fill=ACCENT_COLOR)
    img.save(f"{TEMPLATE_DIR}/top_comment.png")

# 2. Leaderboard Template (600x800)
def create_leaderboard_template():
    img, draw = create_base_canvas(600, 800)
    # Title Placeholder
    draw.rectangle([150, 30, 450, 80], outline=NEON_PURPLE, width=2)
    # Top 3 Slots
    for i in range(3):
        y = 150 + (i * 150)
        draw.rectangle([50, y, 550, y+120], outline=NEON_PURPLE if i==0 else ACCENT_COLOR, width=2)
        # Rank Icon Placeholder
        draw.ellipse([70, y+20, 130, y+80], fill=NEON_PURPLE if i==0 else ACCENT_COLOR)
        # Name + Points Placeholder
        draw.rectangle([160, y+30, 500, y+60], fill=ACCENT_COLOR)
        draw.rectangle([160, y+70, 350, y+100], fill=ACCENT_COLOR)
    img.save(f"{TEMPLATE_DIR}/leaderboard.png")

# 3. Event Announcement Template (1000x600)
def create_event_announcement_template():
    img, draw = create_base_canvas(1000, 600)
    # Event Banner Area
    draw.rectangle([50, 50, 950, 250], outline=NEON_PURPLE, width=3)
    # Title Placeholder
    draw.rectangle([300, 280, 700, 340], fill=NEON_PURPLE)
    # Description Area
    draw.rectangle([100, 370, 900, 500], outline=ACCENT_COLOR, width=1)
    # Date Placeholder
    draw.rectangle([700, 520, 950, 560], fill=ACCENT_COLOR)
    img.save(f"{TEMPLATE_DIR}/event_announcement.png")

# 4. Event Result Template (800x500)
def create_event_result_template():
    img, draw = create_base_canvas(800, 500)
    # Winner Title
    draw.rectangle([200, 40, 600, 100], outline=NEON_PURPLE, width=4)
    # Winner Highlight Area
    draw.ellipse([300, 150, 500, 350], outline=NEON_PURPLE, width=5)
    # Winner Name Placeholder
    draw.rectangle([250, 380, 550, 430], fill=ACCENT_COLOR)
    img.save(f"{TEMPLATE_DIR}/event_result.png")

# 5. Points Reward Template (600x300)
def create_points_reward_template():
    img, draw = create_base_canvas(600, 300)
    # Reward Icon
    draw.polygon([(50, 150), (100, 50), (150, 150), (100, 250)], outline=NEON_PURPLE, width=3)
    # +Points Placeholder
    draw.rectangle([200, 80, 500, 150], outline=NEON_PURPLE, width=2)
    # Username Placeholder
    draw.rectangle([200, 180, 450, 220], fill=ACCENT_COLOR)
    img.save(f"{TEMPLATE_DIR}/points_reward.png")

# 6. Badge Template (400x400)
def create_badge_template():
    img, draw = create_base_canvas(400, 400)
    # Badge Shape (Hexagon-ish)
    points = [(200, 50), (350, 125), (350, 275), (200, 350), (50, 275), (50, 125)]
    draw.polygon(points, outline=NEON_PURPLE, width=5)
    # Icon Placeholder
    draw.ellipse([120, 100, 280, 260], outline=ACCENT_COLOR, width=2)
    # Badge Name Placeholder
    draw.rectangle([100, 300, 300, 340], fill=ACCENT_COLOR)
    img.save(f"{TEMPLATE_DIR}/badge.png")

# تشغيل الوظائف
create_comment_template()
create_leaderboard_template()
create_event_announcement_template()
create_event_result_template()
create_points_reward_template()
create_badge_template()

print("Templates created successfully in assets/templates/")

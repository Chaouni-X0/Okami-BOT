# -*- coding: utf-8 -*-

"""
utils/formatter.py

يحتوي على دوال لتنسيق النصوص والروابط لجعل المنشورات جذابة بصرياً على فيسبوك.
"""

def format_chapter_post(chapter_title, chapter_url, manga_title):
    """
    ينسق نص منشور الفصل الواحد.
    """
    post_text = f"""
╔═════════════════════════════════════════════════════════════════╗
║ ✨ فصل جديد من {manga_title} ✨
║
║ 📚 {chapter_title}
║
║ لقراءة الفصل كاملاً: {chapter_url}
║
║ #مانغا #مانهوا #{manga_title.replace(' ', '')} #OkamiBot 🐺
╚═════════════════════════════════════════════════════════════════╝

تم النشر بواسطة Okami Bot 🐺
"""
    return post_text

def format_compilation_post(manga_info, chapter_links):
    """
    ينسق نص المنشور التجميعي للمانغا/المانهوا.
    """
    title = manga_info.get("title", "")
    description = manga_info.get("description", "")
    
    post_text = f"""
╔═════════════════════════════════════════════════════════════════╗
║ 🌟 عمل جديد على صفحتنا: {title} 🌟
║
║ 📝 الوصف:
║ {description}
║
║ 📖 الفصول المنشورة:
"""
    for i, (chapter_title, chapter_fb_url) in enumerate(chapter_links.items()):
        post_text += f"║   • {chapter_title}: {chapter_fb_url}\n"
    
    post_text += f"""
║
║ #مانغا #مانهوا #{title.replace(' ', '')} #OkamiBot 🐺
╚═════════════════════════════════════════════════════════════════╝

تم النشر بواسطة Okami Bot 🐺
"""
    return post_text

def format_search_result(manga_title, compilation_post_url):
    """
    ينسق نتيجة البحث للمستخدم.
    """
    post_text = f"""
╔═════════════════════════════════════════════════════════════════╗
║ 🔍 نتيجة البحث عن {manga_title} 🔍
║
║ يمكنك العثور على جميع فصول {manga_title} هنا:
║ {compilation_post_url}
║
║ #OkamiBot 🐺
╚═════════════════════════════════════════════════════════════════╝
"""
    return post_text

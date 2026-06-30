"""
🐺 Okami Bot - Admin Dashboard
واجهة تحكم احترافية لإدارة بوت أوكامي
"""

import streamlit as st
import sqlite3
import os
import json
from datetime import datetime, timedelta
import pandas as pd
from pathlib import Path
import hashlib

# ===== إعدادات Streamlit =====
st.set_page_config(
    page_title="🐺 Okami Bot Dashboard",
    page_icon="🐺",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ===== متغيرات عامة =====
DB_PATH = "./src/database/okami.db"
DATA_DIR = "./src/data"
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "okami2024")  # يجب تغييره في الإنتاج

# ===== دوال مساعدة =====
def hash_password(password):
    """تشفير كلمة المرور"""
    return hashlib.sha256(password.encode()).hexdigest()

def check_authentication():
    """التحقق من المصادقة"""
    if "authenticated" not in st.session_state:
        st.session_state.authenticated = False
    
    if not st.session_state.authenticated:
        st.warning("⚠️ يجب عليك تسجيل الدخول أولاً")
        password = st.text_input("أدخل كلمة المرور:", type="password", key="login_password")
        if st.button("تسجيل الدخول"):
            if hash_password(password) == hash_password(ADMIN_PASSWORD):
                st.session_state.authenticated = True
                st.success("✅ تم تسجيل الدخول بنجاح!")
                st.rerun()
            else:
                st.error("❌ كلمة المرور غير صحيحة")
        return False
    return True

def get_db_connection():
    """الاتصال بقاعدة البيانات"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def get_queue_stats():
    """الحصول على إحصائيات الطابور"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # إحصائيات الطابور
        cursor.execute("SELECT COUNT(*) as count FROM publish_queue WHERE status = 'pending'")
        pending = cursor.fetchone()['count']
        
        cursor.execute("SELECT COUNT(*) as count FROM publish_queue WHERE status = 'processing'")
        processing = cursor.fetchone()['count']
        
        cursor.execute("SELECT COUNT(*) as count FROM publish_queue WHERE status = 'failed'")
        failed = cursor.fetchone()['count']
        
        cursor.execute("SELECT COUNT(*) as count FROM publish_queue")
        total = cursor.fetchone()['count']
        
        conn.close()
        
        return {
            "pending": pending,
            "processing": processing,
            "failed": failed,
            "total": total
        }
    except Exception as e:
        st.error(f"❌ خطأ في جلب إحصائيات الطابور: {str(e)}")
        return {"pending": 0, "processing": 0, "failed": 0, "total": 0}

def get_manga_stats():
    """الحصول على إحصائيات المانهوا"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) as count FROM manga")
        total_manga = cursor.fetchone()['count']
        
        cursor.execute("SELECT COUNT(*) as count FROM chapters WHERE is_published = 1")
        published_chapters = cursor.fetchone()['count']
        
        conn.close()
        
        return {
            "total_manga": total_manga,
            "published_chapters": published_chapters
        }
    except Exception as e:
        st.error(f"❌ خطأ في جلب إحصائيات المانهوا: {str(e)}")
        return {"total_manga": 0, "published_chapters": 0}

def get_queue_items():
    """الحصول على عناصر الطابور"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT pq.*, m.title as manga_title
            FROM publish_queue pq
            LEFT JOIN manga m ON pq.manga_id = m.id
            ORDER BY pq.created_at DESC
            LIMIT 50
        """)
        
        items = cursor.fetchall()
        conn.close()
        
        return [dict(item) for item in items]
    except Exception as e:
        st.error(f"❌ خطأ في جلب عناصر الطابور: {str(e)}")
        return []

def get_manga_list():
    """الحصول على قائمة المانهوا"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM manga ORDER BY created_at DESC")
        manga_list = cursor.fetchall()
        conn.close()
        
        return [dict(item) for item in manga_list]
    except Exception as e:
        st.error(f"❌ خطأ في جلب قائمة المانهوا: {str(e)}")
        return []

def clear_failed_queue():
    """مسح الفصول الفاشلة من الطابور"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("DELETE FROM publish_queue WHERE status = 'failed'")
        conn.commit()
        conn.close()
        
        st.success("✅ تم مسح الفصول الفاشلة بنجاح")
    except Exception as e:
        st.error(f"❌ خطأ: {str(e)}")

def retry_failed_queue():
    """إعادة محاولة الفصول الفاشلة"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("UPDATE publish_queue SET status = 'pending' WHERE status = 'failed'")
        conn.commit()
        conn.close()
        
        st.success("✅ تم إعادة محاولة الفصول الفاشلة")
    except Exception as e:
        st.error(f"❌ خطأ: {str(e)}")

def delete_manga(manga_id):
    """حذف مانهوا من قاعدة البيانات"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # حذف الفصول المرتبطة
        cursor.execute("DELETE FROM chapters WHERE manga_id = ?", (manga_id,))
        
        # حذف عناصر الطابور المرتبطة
        cursor.execute("DELETE FROM publish_queue WHERE manga_id = ?", (manga_id,))
        
        # حذف المانهوا
        cursor.execute("DELETE FROM manga WHERE id = ?", (manga_id,))
        
        conn.commit()
        conn.close()
        
        st.success("✅ تم حذف المانهوا بنجاح")
    except Exception as e:
        st.error(f"❌ خطأ: {str(e)}")

# ===== واجهة المستخدم الرئيسية =====

# شريط جانبي
with st.sidebar:
    st.title("🐺 Okami Bot")
    st.markdown("---")
    
    if st.session_state.get("authenticated"):
        st.success("✅ مسجل دخول")
        if st.button("تسجيل الخروج"):
            st.session_state.authenticated = False
            st.rerun()
    
    st.markdown("---")
    page = st.radio(
        "اختر الصفحة:",
        ["📊 لوحة المعلومات", "📋 الطابور", "📚 المانهوا", "⚙️ الإعدادات"]
    )

# التحقق من المصادقة
if not check_authentication():
    st.stop()

# ===== الصفحة الرئيسية: لوحة المعلومات =====
if page == "📊 لوحة المعلومات":
    st.title("📊 لوحة المعلومات")
    st.markdown("---")
    
    # إحصائيات الطابور
    queue_stats = get_queue_stats()
    manga_stats = get_manga_stats()
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric("⏳ قيد الانتظار", queue_stats["pending"], delta="فصول")
    
    with col2:
        st.metric("⚙️ قيد المعالجة", queue_stats["processing"], delta="فصول")
    
    with col3:
        st.metric("❌ فاشلة", queue_stats["failed"], delta="فصول")
    
    with col4:
        st.metric("📚 إجمالي المانهوا", manga_stats["total_manga"], delta="مانهوا")
    
    st.markdown("---")
    
    # رسم بياني للإحصائيات
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("📊 توزيع حالات الطابور")
        queue_data = {
            "قيد الانتظار": queue_stats["pending"],
            "قيد المعالجة": queue_stats["processing"],
            "فاشلة": queue_stats["failed"]
        }
        st.bar_chart(queue_data)
    
    with col2:
        st.subheader("📈 إحصائيات عامة")
        stats_data = {
            "إجمالي الفصول المنشورة": manga_stats["published_chapters"],
            "إجمالي المانهوا": manga_stats["total_manga"]
        }
        st.bar_chart(stats_data)
    
    st.markdown("---")
    
    # آخر 10 عناصر في الطابور
    st.subheader("🔄 آخر العناصر في الطابور")
    queue_items = get_queue_items()[:10]
    
    if queue_items:
        df = pd.DataFrame(queue_items)
        df = df[['manga_title', 'chapter_number', 'status', 'created_at']]
        df.columns = ['المانهوا', 'رقم الفصل', 'الحالة', 'التاريخ']
        st.dataframe(df, use_container_width=True)
    else:
        st.info("ℹ️ لا توجد عناصر في الطابور")

# ===== صفحة الطابور =====
elif page == "📋 الطابور":
    st.title("📋 إدارة الطابور")
    st.markdown("---")
    
    queue_stats = get_queue_stats()
    
    # عرض الإحصائيات
    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("⏳ قيد الانتظار", queue_stats["pending"])
    with col2:
        st.metric("⚙️ قيد المعالجة", queue_stats["processing"])
    with col3:
        st.metric("❌ فاشلة", queue_stats["failed"])
    
    st.markdown("---")
    
    # أزرار التحكم
    col1, col2, col3 = st.columns(3)
    
    with col1:
        if st.button("🔄 إعادة محاولة الفاشلة"):
            retry_failed_queue()
            st.rerun()
    
    with col2:
        if st.button("🗑️ مسح الفاشلة"):
            if st.checkbox("تأكيد الحذف"):
                clear_failed_queue()
                st.rerun()
    
    with col3:
        st.write("")  # مسافة فارغة
    
    st.markdown("---")
    
    # عرض جميع عناصر الطابور
    st.subheader("📋 جميع عناصر الطابور")
    queue_items = get_queue_items()
    
    if queue_items:
        df = pd.DataFrame(queue_items)
        df = df[['manga_title', 'chapter_number', 'status', 'created_at']]
        df.columns = ['المانهوا', 'رقم الفصل', 'الحالة', 'التاريخ']
        st.dataframe(df, use_container_width=True)
    else:
        st.info("ℹ️ الطابور فارغ")

# ===== صفحة المانهوا =====
elif page == "📚 المانهوا":
    st.title("📚 إدارة المانهوا")
    st.markdown("---")
    
    manga_list = get_manga_list()
    
    if manga_list:
        for manga in manga_list:
            with st.expander(f"📖 {manga['title']}"):
                col1, col2, col3 = st.columns(3)
                
                with col1:
                    st.write(f"**الحالة:** {manga['status']}")
                    st.write(f"**الموقع:** {manga['source_site_key']}")
                
                with col2:
                    st.write(f"**تاريخ الإنشاء:** {manga['created_at']}")
                    st.write(f"**آخر تحديث:** {manga['updated_at']}")
                
                with col3:
                    if st.button(f"🗑️ حذف", key=f"delete_{manga['id']}"):
                        delete_manga(manga['id'])
                        st.rerun()
    else:
        st.info("ℹ️ لا توجد مانهوا في قاعدة البيانات")

# ===== صفحة الإعدادات =====
elif page == "⚙️ الإعدادات":
    st.title("⚙️ الإعدادات")
    st.markdown("---")
    
    st.subheader("🔐 معلومات النظام")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.write(f"**إصدار البوت:** 5.0.0")
        st.write(f"**حالة قاعدة البيانات:** ✅ متصلة")
    
    with col2:
        st.write(f"**وقت التحديث:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        st.write(f"**مسار قاعدة البيانات:** {DB_PATH}")
    
    st.markdown("---")
    
    st.subheader("🧹 تنظيف البيانات")
    
    if st.button("🧹 تنظيف الملفات المؤقتة"):
        try:
            temp_dir = Path("./src/temp")
            if temp_dir.exists():
                import shutil
                shutil.rmtree(temp_dir)
                temp_dir.mkdir(parents=True, exist_ok=True)
                st.success("✅ تم تنظيف الملفات المؤقتة بنجاح")
            else:
                st.info("ℹ️ لا توجد ملفات مؤقتة")
        except Exception as e:
            st.error(f"❌ خطأ: {str(e)}")
    
    st.markdown("---")
    
    st.subheader("📝 السجلات")
    
    if st.checkbox("عرض السجلات"):
        try:
            with open("./src/logs/combined.log", "r", encoding="utf-8") as f:
                logs = f.readlines()[-50:]  # آخر 50 سطر
                st.code("".join(logs), language="log")
        except FileNotFoundError:
            st.warning("⚠️ لم يتم العثور على ملف السجلات")

# تذييل
st.markdown("---")
st.markdown("""
<div style="text-align: center; color: gray; font-size: 12px;">
    🐺 Okami Bot Dashboard v1.0 | Powered by Streamlit
</div>
""", unsafe_allow_html=True)

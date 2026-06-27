# -*- coding: utf-8 -*-

"""
database/
حزمة قاعدة البيانات لبوت أوكامي.

تحتوي على:
- db.py: إدارة SQLite (حفظ + استرجاع + حذف + إحصائيات)
- notifications.py: نظام الإشعارات وقائمة المتابعة
- users.py: نظام المستخدمين والتقييمات والميزات الاجتماعية
"""

from database.db import init_db
from database.notifications import init_notifications_db
from database.users import init_users_db

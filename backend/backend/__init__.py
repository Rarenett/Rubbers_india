import re
import django.utils.cache
from django.db.backends.base.base import BaseDatabaseWrapper

# Allow MariaDB < 10.11 (e.g., MariaDB 10.4 from XAMPP)
BaseDatabaseWrapper.check_database_version_supported = lambda self: None

# MariaDB < 10.5 does not support INSERT ... RETURNING
from django.db.backends.mysql.features import DatabaseFeatures
DatabaseFeatures.can_return_columns_from_insert = property(
    lambda self: bool(self.connection.mysql_is_mariadb and self.connection.mysql_version >= (10, 5))
)

# MariaDB < 10.7 does not support native UUID data type
DatabaseFeatures.has_native_uuid_field = property(
    lambda self: bool(self.connection.mysql_is_mariadb and self.connection.mysql_version >= (10, 7))
)

# Compatibility patch for djangorestframework with Django 5.1+
if not hasattr(django.utils.cache, 'cc_delim_re'):
    django.utils.cache.cc_delim_re = re.compile(r"\s*,\s*")


import os
import time
import json
import subprocess
from datetime import datetime
from pathlib import Path
from django.core.management.base import BaseCommand
from django.conf import settings

class Command(BaseCommand):
    help = 'Safely backs up the ERP MySQL database using mysqldump.'

    def handle(self, *args, **options):
        # 1. Resolve configuration
        db_settings = settings.DATABASES['default']
        engine = db_settings.get('ENGINE', '')
        
        if 'mysql' not in engine:
            self.stdout.write(self.style.ERROR(f"Unsupported database engine for automatic backup: {engine}. Expecting mysql."))
            return

        db_name = db_settings.get('NAME')
        db_user = db_settings.get('USER')
        db_password = db_settings.get('PASSWORD')
        db_host = db_settings.get('HOST', 'localhost')
        db_port = db_settings.get('PORT', '3306')

        if not all([db_name, db_user]):
            self.stdout.write(self.style.ERROR("Database NAME and USER must be configured."))
            return

        # 2. Prepare Backup Directory
        backup_dir = getattr(settings, 'DATABASE_BACKUP_DIR', settings.BASE_DIR / 'backups' / 'database')
        backup_dir = Path(backup_dir)
        backup_dir.mkdir(parents=True, exist_ok=True)
        
        status_file = backup_dir / 'backup_status.json'
        
        timestamp = datetime.now().strftime('%Y-%m-%d_%H%M%S')
        final_filename = f"erp_backup_{timestamp}.sql"
        final_path = backup_dir / final_filename
        tmp_path = backup_dir / f"{final_filename}.tmp"
        
        # 3. Build mysqldump command
        # Passing password via environment variable MYSQL_PWD is the most secure way for mysqldump
        env = os.environ.copy()
        if db_password:
            env['MYSQL_PWD'] = str(db_password)
            
        import shutil
        mysqldump_path = shutil.which('mysqldump')
        if not mysqldump_path:
            # Fallback for Windows XAMPP environments
            if os.path.exists(r"C:\xampp\mysql\bin\mysqldump.exe"):
                mysqldump_path = r"C:\xampp\mysql\bin\mysqldump.exe"
            else:
                mysqldump_path = 'mysqldump' # Will likely fail, but attempt it anyway

        cmd = [
            mysqldump_path,
            '--user', str(db_user),
            '--host', str(db_host),
        ]
        
        if db_port:
            cmd.extend(['--port', str(db_port)])
            
        # Add options to make it safe, consistent, and quick
        cmd.extend([
            '--single-transaction',
            '--quick',
            '--lock-tables=false',
            str(db_name)
        ])
        
        self.stdout.write(f"Starting backup for database {db_name} to {final_filename}...")
        
        # 4. Execute Backup
        success = False
        error_msg = ""
        file_size = 0
        
        try:
            with open(tmp_path, 'wb') as f:
                # Run mysqldump
                process = subprocess.run(cmd, env=env, stdout=f, stderr=subprocess.PIPE)
                
            if process.returncode == 0:
                # Verify file size isn't empty
                if tmp_path.exists() and tmp_path.stat().st_size > 0:
                    tmp_path.rename(final_path)
                    success = True
                    file_size = final_path.stat().st_size
                    self.stdout.write(self.style.SUCCESS(f"Backup completed successfully: {final_path}"))
                else:
                    error_msg = "Backup failed: Generated file is empty."
                    if tmp_path.exists():
                        tmp_path.unlink()
            else:
                error_msg = f"Backup failed with return code {process.returncode}. Error: {process.stderr.decode('utf-8', errors='ignore')}"
                if tmp_path.exists():
                    tmp_path.unlink()
                    
        except Exception as e:
            error_msg = f"Backup failed unexpectedly: {str(e)}"
            if tmp_path.exists():
                tmp_path.unlink()
                
        if not success:
            self.stdout.write(self.style.ERROR(error_msg))
            
        # 5. Clean up old backups (Retention Policy)
        retention_days = getattr(settings, 'BACKUP_RETENTION_DAYS', 30)
        now_time = time.time()
        
        if success: # Only delete old backups if the current one succeeded!
            deleted_count = 0
            for sql_file in backup_dir.glob('erp_backup_*.sql'):
                if sql_file == final_path:
                    continue
                file_age_days = (now_time - sql_file.stat().st_mtime) / (60 * 60 * 24)
                if file_age_days > retention_days:
                    try:
                        sql_file.unlink()
                        deleted_count += 1
                    except Exception as e:
                        self.stdout.write(self.style.WARNING(f"Failed to delete old backup {sql_file.name}: {str(e)}"))
                        
            if deleted_count > 0:
                self.stdout.write(f"Cleaned up {deleted_count} old backups (retention: {retention_days} days).")
                
        # 6. Write Status to JSON
        # Read existing status if any to preserve previous successful backup info if current fails
        status_data = {}
        if status_file.exists():
            try:
                with open(status_file, 'r') as f:
                    status_data = json.load(f)
            except:
                pass
                
        current_status = {
            'last_run': datetime.now().isoformat(),
            'status': 'success' if success else 'failed',
            'error': error_msg if not success else None,
        }
        
        if success:
            current_status['filename'] = final_filename
            current_status['size_bytes'] = file_size
        else:
            # Preserve the last successful backup filename and size
            if 'filename' in status_data:
                current_status['filename'] = status_data['filename']
            if 'size_bytes' in status_data:
                current_status['size_bytes'] = status_data['size_bytes']
                
        with open(status_file, 'w') as f:
            json.dump(current_status, f, indent=4)
            
        if not success:
            import sys
            sys.exit(1)

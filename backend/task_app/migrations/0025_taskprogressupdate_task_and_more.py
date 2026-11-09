from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('task_app', '0024_subtask_created_by'),
    ]

    operations = [
        migrations.AddField(
            model_name='taskprogressupdate',
            name='task',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='progress_updates', to='task_app.task'),
        ),
        migrations.AlterField(
            model_name='taskprogressupdate',
            name='assignment',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='progress_updates', to='task_app.taskassignment'),
        ),
    ]

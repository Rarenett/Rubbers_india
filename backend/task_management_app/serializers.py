from rest_framework import serializers
from .models import Task

class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = '__all__'
        read_only_fields = ['user', 'createdAt', 'updatedAt']

class AdminTaskSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = '__all__'
        read_only_fields = ['assigned_by', 'createdAt', 'updatedAt']

    def get_user_name(self, obj):
        if obj.user:
            return obj.user.get_full_name() or obj.user.username or obj.user.email
        return None

    def get_department_name(self, obj):
        if obj.department:
            return obj.department.name
        return None

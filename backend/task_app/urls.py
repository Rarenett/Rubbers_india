from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    MyDepartmentEmployeeListView, DepartmentListView, DepartmentEmployeeListView,
    SubtaskAttachmentDeleteView, SubtaskDetailView, SubtaskListCreateView,
    TaskAssignmentViewSet, TaskAttachmentViewSet, TaskCategoryViewSet,
    TaskProgressUpdateViewSet, TaskSubCategoryViewSet, TaskViewSet,
    TaskVoteRequestViewSet, TeamViewSet, MyTaskReportView,
    NotVotedTasksReportView, NotStartedTasksReportView
)

router = DefaultRouter()
router.register(r'categories', TaskCategoryViewSet),
router.register(r'subcategories', TaskSubCategoryViewSet),
router.register(r'tasks', TaskViewSet),
router.register(r'task-attachments', TaskAttachmentViewSet),
router.register(r'task-vote-requests', TaskVoteRequestViewSet, basename='task-vote-request'),
router.register(r'teams', TeamViewSet, basename='team'),
router.register(r'task-assignments', TaskAssignmentViewSet, basename='task-assignment'),
router.register(r'task-progress-updates', TaskProgressUpdateViewSet, basename='task-progress-update')

urlpatterns = [
       path('', include(router.urls)),
       path('subtasks/', SubtaskListCreateView.as_view(), name='subtask-list'),
       path('subtasks/<int:pk>/', SubtaskDetailView.as_view(), name='subtask-detail'),
       path('subtasks/attachments/<int:pk>/', SubtaskAttachmentDeleteView.as_view(), name='subtask-attachment-delete'),

       path('departments/', DepartmentListView.as_view(), name='department-list'),
       path('departments/<int:department_id>/employees/', DepartmentEmployeeListView.as_view(), name='department-employees'),
       path('my-department/employees/', MyDepartmentEmployeeListView.as_view(), name='my-department-employees'),
       path('my-task-report/', MyTaskReportView.as_view(), name='my-task-report'),
       path('not-voted-tasks-report/', NotVotedTasksReportView.as_view(), name='not-voted-tasks-report'),
       path('not-started-tasks-report/', NotStartedTasksReportView.as_view(), name='not-started-tasks-report'),
   ]
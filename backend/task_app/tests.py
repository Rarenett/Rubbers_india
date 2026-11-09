import datetime
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from rarenett_app.models import Employee
from task_app.models import (
    Task,
    Subtask,
    TaskVoteRequest,
    TaskVoter,
    TaskAssignment,
    Team,
    TeamMember,
)

User = get_user_model()


class TaskAssignmentFilteringTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Users
        self.john_user = User.objects.create_user(username='john', password='password', first_name='John', email='john@example.com')
        self.aswathy_user = User.objects.create_user(username='aswathy', password='password', first_name='Aswathy', email='aswathy@example.com')
        self.aleena_user = User.objects.create_user(username='aleena', password='password', first_name='Aleena', email='aleena@example.com')
        self.anu_user = User.objects.create_user(username='anu', password='password', first_name='Anu', email='anu@example.com')

        # Employees
        self.john_emp = Employee.objects.create(user=self.john_user)
        self.aswathy_emp = Employee.objects.create(user=self.aswathy_user)
        self.aleena_emp = Employee.objects.create(user=self.aleena_user)
        self.anu_emp = Employee.objects.create(user=self.anu_user)

        # ── Setup Bug Scenario: ──
        # John creates "Task Xyz" (group task) and assigns it to Aswathy.
        self.task_xyz = Task.objects.create(
            task_name="Task Xyz",
            task_type="group",
            description="Parent Group Task"
        )
        cutoff = timezone.now() - datetime.timedelta(days=1)
        self.vr_xyz = TaskVoteRequest.objects.create(
            task=self.task_xyz,
            assigned_employee=self.aswathy_emp,
            approval_type="single",
            cutoff_date=cutoff,
            created_by=self.john_user,
            is_active=True
        )
        # Approved vote
        TaskVoter.objects.create(
            vote_request=self.vr_xyz,
            employee=self.john_emp,
            vote='yes',
            voted_at=cutoff - datetime.timedelta(hours=1)
        )
        self.assertEqual(self.vr_xyz.result_status, 'approved')

        # Aswathy splits "Task Xyz" into two subtasks:
        # "Task Xyz-1" assigned to Aleena (50%) and "Task Xyz-2" assigned to Anu (50%)
        self.subtask_1 = Subtask.objects.create(
            task=self.task_xyz,
            subtask_name="Task Xyz-1",
            task_type="individual",
            description="First subtask"
        )
        self.subtask_2 = Subtask.objects.create(
            task=self.task_xyz,
            subtask_name="Task Xyz-2",
            task_type="individual",
            description="Second subtask"
        )

        self.assignment_aleena = TaskAssignment.objects.create(
            task=self.task_xyz,
            subtask=self.subtask_1,
            employee=self.aleena_emp,
            percentage=Decimal('50.00'),
            assigned_by=self.aswathy_user
        )
        self.assignment_anu = TaskAssignment.objects.create(
            task=self.task_xyz,
            subtask=self.subtask_2,
            employee=self.anu_emp,
            percentage=Decimal('50.00'),
            assigned_by=self.aswathy_user
        )

    def test_my_assigned_tasks_prevents_subtask_assignee_leakage(self):
        """Aleena and Anu must NOT see the parent task 'Task Xyz' in my_assigned_tasks.
        Only Aswathy (the direct assignee) should see it. John (creator) should not see it."""
        url = '/api/task/task-vote-requests/my-assigned-tasks/'

        # John: 0 tasks
        self.client.force_authenticate(user=self.john_user)
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 0)

        # Aswathy: exactly 1 task ("Task Xyz")
        self.client.force_authenticate(user=self.aswathy_user)
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['id'], self.vr_xyz.id)
        self.assertEqual(res.data[0]['task_name'], "Task Xyz")

        # Aleena: 0 root tasks (must not see parent Task Xyz)
        self.client.force_authenticate(user=self.aleena_user)
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 0)

        # Anu: 0 root tasks (must not see parent Task Xyz)
        self.client.force_authenticate(user=self.anu_user)
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 0)

    def test_my_subtasks_returns_exact_subtask_for_each_assignee(self):
        """Aleena sees Task Xyz-1, Anu sees Task Xyz-2. Aswathy and John see 0 subtasks."""
        url = '/api/task/task-assignments/my-subtasks/'

        # Aleena sees Task Xyz-1
        self.client.force_authenticate(user=self.aleena_user)
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['subtask_name'], "Task Xyz-1")

        # Anu sees Task Xyz-2
        self.client.force_authenticate(user=self.anu_user)
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['subtask_name'], "Task Xyz-2")

        # Aswathy sees 0 subtasks
        self.client.force_authenticate(user=self.aswathy_user)
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 0)

        # John sees 0 subtasks
        self.client.force_authenticate(user=self.john_user)
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 0)

    def test_my_leaf_assignments_four_role_deduplication(self):
        """On 'Update Progress' page:
        - John: 1 card ('Task Xyz', delegated=True, can_update_progress=False)
        - Aswathy: 1 card ('Task Xyz', delegated=True, can_update_progress=False)
        - Aleena: 1 card ('Task Xyz-1', is_delegated=False, can_update_progress=True)
        - Anu: 1 card ('Task Xyz-2', is_delegated=False, can_update_progress=True)
        No duplicate cards for anyone."""
        url = '/api/task/task-assignments/my-leaf-assignments/'

        # John
        self.client.force_authenticate(user=self.john_user)
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['id'], f"vr_{self.vr_xyz.id}")
        self.assertEqual(res.data[0]['subtask_name'], "Task Xyz")
        self.assertTrue(res.data[0]['is_delegated'])
        self.assertFalse(res.data[0]['can_update_progress'])

        # Aswathy: exactly 1 card for Task Xyz (not Aleena's or Anu's subtask cards)
        self.client.force_authenticate(user=self.aswathy_user)
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['id'], f"vr_{self.vr_xyz.id}")
        self.assertEqual(res.data[0]['subtask_name'], "Task Xyz")
        self.assertTrue(res.data[0]['is_delegated'])
        self.assertFalse(res.data[0]['can_update_progress'])

        # Aleena: exactly 1 card for Task Xyz-1
        self.client.force_authenticate(user=self.aleena_user)
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['subtask_name'], "Task Xyz-1")
        self.assertFalse(res.data[0]['is_delegated'])
        self.assertTrue(res.data[0]['can_update_progress'])

        # Anu: exactly 1 card for Task Xyz-2
        self.client.force_authenticate(user=self.anu_user)
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['subtask_name'], "Task Xyz-2")
        self.assertFalse(res.data[0]['is_delegated'])
        self.assertTrue(res.data[0]['can_update_progress'])

    def test_unsplit_individual_task_progress_update_and_deduplication(self):
        """For an unsplit individual task:
        - Direct assignee sees exactly 1 task in my_assigned_tasks.
        - Direct assignee sees 1 card in my_leaf_assignments with can_update_progress=True.
        - After logging a progress update (which creates the dummy TaskAssignment),
          direct assignee still sees exactly 1 task in my_assigned_tasks,
          0 cards in my_subtasks (dummy assignment excluded),
          and still exactly 1 card in my_leaf_assignments with can_update_progress=True."""
        task_indiv = Task.objects.create(
            task_name="Task Solo",
            task_type="individual",
            description="Individual Unsplit Task"
        )
        cutoff = timezone.now() - datetime.timedelta(days=1)
        vr_indiv = TaskVoteRequest.objects.create(
            task=task_indiv,
            assigned_employee=self.aswathy_emp,
            approval_type="single",
            cutoff_date=cutoff,
            created_by=self.john_user,
            is_active=True
        )
        TaskVoter.objects.create(
            vote_request=vr_indiv,
            employee=self.john_emp,
            vote='yes',
            voted_at=cutoff - datetime.timedelta(hours=1)
        )

        self.client.force_authenticate(user=self.aswathy_user)

        # Before update
        res_assigned = self.client.get('/api/task/task-vote-requests/my-assigned-tasks/')
        # Task Xyz + Task Solo = 2 tasks
        solo_tasks = [t for t in res_assigned.data if t['task_name'] == "Task Solo"]
        self.assertEqual(len(solo_tasks), 1)

        res_leaf = self.client.get('/api/task/task-assignments/my-leaf-assignments/')
        solo_cards = [c for c in res_leaf.data if c['subtask_name'] == "Task Solo"]
        self.assertEqual(len(solo_cards), 1)
        self.assertTrue(solo_cards[0]['can_update_progress'])
        self.assertFalse(solo_cards[0]['is_delegated'])

        # Post a progress update using vr_id
        res_update = self.client.post('/api/task/task-progress-updates/', {
            'assignment': f"vr_{vr_indiv.id}",
            'percentage': '25.00',
            'description_of_work': 'Completed initial draft',
        })
        self.assertEqual(res_update.status_code, 201)

        # After update:
        # 1. my-assigned-tasks should still only have 1 card for Task Solo
        res_assigned_after = self.client.get('/api/task/task-vote-requests/my-assigned-tasks/')
        solo_tasks_after = [t for t in res_assigned_after.data if t['task_name'] == "Task Solo"]
        self.assertEqual(len(solo_tasks_after), 1)

        # 2. my-subtasks should NOT return the auto-created dummy assignment
        res_subtasks_after = self.client.get('/api/task/task-assignments/my-subtasks/')
        solo_subtasks = [s for s in res_subtasks_after.data if s['subtask_name'] == "Task Solo"]
        self.assertEqual(len(solo_subtasks), 0)

        # 3. my-leaf-assignments should still only have 1 card for Task Solo, and can_update_progress must stay True
        res_leaf_after = self.client.get('/api/task/task-assignments/my-leaf-assignments/')
        solo_cards_after = [c for c in res_leaf_after.data if c['subtask_name'] == "Task Solo"]
        self.assertEqual(len(solo_cards_after), 1)
        self.assertTrue(solo_cards_after[0]['can_update_progress'])
        self.assertFalse(solo_cards_after[0]['is_delegated'])
        self.assertEqual(float(solo_cards_after[0]['completed_percentage']), 25.0)

    def test_group_task_team_member_does_not_see_parent_task(self):
        """Team members on a top-level task team must NOT see the parent task in my_assigned_tasks.
        Only the direct assignee (lead) sees the parent task."""
        # Create team for Task Xyz and add Aleena as team member
        team = Team.objects.create(task=self.task_xyz, created_by=self.aswathy_user)
        TeamMember.objects.create(team=team, employee=self.aleena_emp)

        self.client.force_authenticate(user=self.aleena_user)
        res = self.client.get('/api/task/task-vote-requests/my-assigned-tasks/')
        self.assertEqual(res.status_code, 200)
        # Aleena is a team member, but not assigned_employee, so she does NOT see the parent task
        self.assertEqual(len(res.data), 0)

    def test_group_task_progress_update_dummy_row_excluded(self):
        """When progress is logged on a GROUP task's vr_<id> card, TaskProgressUpdateViewSet
        auto-creates a dummy Subtask (task_type='individual', subtask_name=task.task_name)
        and TaskAssignment (percentage=100.00) under the group task.
        Assert that this dummy row does NOT appear in my_subtasks() or my_leaf_assignments()
        as a phantom subtask card."""
        self.client.force_authenticate(user=self.aswathy_user)

        # Log progress against vr_<id> for the group task (Task Xyz)
        res_update = self.client.post('/api/task/task-progress-updates/', {
            'assignment': f"vr_{self.vr_xyz.id}",
            'percentage': '15.00',
            'description_of_work': 'Progress logged on parent group task',
        })
        self.assertEqual(res_update.status_code, 201)

        # Verify that the dummy row was created with subtask.task_type='individual' and parent task.task_type='group'
        dummy_subtask = Subtask.objects.filter(
            task=self.task_xyz,
            subtask_name=self.task_xyz.task_name,
            task_type='individual'
        ).first()
        self.assertIsNotNone(dummy_subtask)
        self.assertEqual(self.task_xyz.task_type, 'group')

        dummy_assign = TaskAssignment.objects.filter(
            task=self.task_xyz,
            subtask=dummy_subtask,
            employee=self.aswathy_emp,
            percentage=Decimal('100.00')
        ).first()
        self.assertIsNotNone(dummy_assign)

        # 1. my_subtasks: must NOT return the dummy assignment
        res_subtasks = self.client.get('/api/task/task-assignments/my-subtasks/')
        self.assertEqual(res_subtasks.status_code, 200)
        phantom_subtasks = [s for s in res_subtasks.data if s['subtask_name'] == "Task Xyz"]
        self.assertEqual(len(phantom_subtasks), 0)

        # 2. my_leaf_assignments: must NOT return a phantom Section 1 card for the dummy assignment
        res_leaf = self.client.get('/api/task/task-assignments/my-leaf-assignments/')
        self.assertEqual(res_leaf.status_code, 200)
        xyz_cards = [c for c in res_leaf.data if c['subtask_name'] == "Task Xyz"]
        # Exactly 1 card for Task Xyz (the vr_ card from Section 3, NOT a duplicate from Section 1)
        self.assertEqual(len(xyz_cards), 1)
        self.assertEqual(xyz_cards[0]['id'], f"vr_{self.vr_xyz.id}")


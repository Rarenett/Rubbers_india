from typing import Dict, Any, List
from django.utils import timezone
from .models import RoleMenuPermission, Role


def get_active_roles(user) -> List[Role]:
    """
    Returns the list of all roles that are currently active for a user.
    This includes:
      1. The user's primary role (user.role)
      2. Any additional roles from EmployeeRoleExpiry where today < expiry_date.
         Falls back to legacy roles_applicable_date for records that have no
         EmployeeRoleExpiry entries yet.
    """
    roles = []

    primary_role = getattr(user, 'role', None)
    if primary_role:
        roles.append(primary_role)

    try:
        # Navigate: user -> candidate (via employee_profile) -> employment_details
        employee = getattr(user, 'employee', None)
        candidate = getattr(employee, 'candidate', None) if employee else None
        if candidate is None:
            from rarenett_app.models import EmploymentDetails
            emp_detail = EmploymentDetails.objects.filter(
                user__employee_profile__user=user
            ).prefetch_related('roles', 'role_expiries__role').first()
        else:
            from rarenett_app.models import EmploymentDetails
            emp_detail = EmploymentDetails.objects.filter(
                user=candidate
            ).prefetch_related('roles', 'role_expiries__role').first()

        if emp_detail:
            today = timezone.now().date()
            role_expiries = emp_detail.role_expiries.all()

            if role_expiries.exists():
                # New path: use per-role expiry dates
                # A role is active if it has no expiry date OR today is on or before the expiry date
                for expiry_entry in role_expiries:
                    if expiry_entry.expiry_date is None or today <= expiry_entry.expiry_date:
                        extra_role = expiry_entry.role
                        if extra_role not in roles:
                            roles.append(extra_role)
            elif emp_detail.roles_applicable_date:
                # Legacy fallback: single expiry date for all roles
                if today <= emp_detail.roles_applicable_date:
                    for extra_role in emp_detail.roles.all():
                        if extra_role not in roles:
                            roles.append(extra_role)
    except Exception:
        pass  # Fail silently; worst case user gets only primary role permissions

    return roles


def get_user_permissions(user) -> Dict[str, Any]:
    """
    Returns a dictionary of permissions for the user, merging permissions
    from all currently-active roles (primary + any unexpired additional roles).
    """
    if getattr(user, 'is_superuser', False):
        return {"_is_superuser": {"all": True}}

    active_roles = get_active_roles(user)
    if not active_roles:
        return {}

    role_permissions = RoleMenuPermission.objects.filter(
        role__in=active_roles
    )

    explicit_menu_perms = {}
    explicit_submenu_perms = {}
    explicit_subsubmenu_perms = {}

    for perm in role_permissions:
        actions = {
            "view": perm.can_view,
            "create": perm.can_create,
            "edit": perm.can_edit,
            "delete": perm.can_delete,
            "approve": perm.can_approve,
            "reject": perm.can_reject,
            "details": perm.can_details,
            "allocate": perm.can_allocate,
            "history": perm.can_history
        }

        if perm.sub_submenu_id:
            if perm.sub_submenu_id not in explicit_subsubmenu_perms:
                explicit_subsubmenu_perms[perm.sub_submenu_id] = []
            explicit_subsubmenu_perms[perm.sub_submenu_id].append(actions)
        elif perm.submenu_id:
            if perm.submenu_id not in explicit_submenu_perms:
                explicit_submenu_perms[perm.submenu_id] = []
            explicit_submenu_perms[perm.submenu_id].append(actions)
        elif perm.menu_id:
            if perm.menu_id not in explicit_menu_perms:
                explicit_menu_perms[perm.menu_id] = []
            explicit_menu_perms[perm.menu_id].append(actions)

    def _merge_actions(list_of_actions):
        merged = {k: False for k in ["view", "create", "edit", "delete", "approve", "reject", "details", "allocate", "history"]}
        for actions in list_of_actions:
            for k, v in actions.items():
                merged[k] = merged[k] or v
        return merged

    permissions_dict: Dict[str, Dict[str, bool]] = {}

    def _add_to_dict(obj_type, obj_id, code, actions):
        if not actions: return
        merged = _merge_actions([actions])
        if any(merged.values()):
            permissions_dict[f"{obj_type}_{obj_id}"] = merged
            if code:
                permissions_dict[code] = merged
                # Aliases for singular/plural/hyphen variants
                code_aliases = {
                    'task': ['tasks'],
                    'tasks': ['task'],
                    'subtasks': ['subtask'],
                    'subtask': ['subtasks'],
                    'sub-categories': ['subcategories'],
                    'subcategories': ['sub-categories'],
                    'categories': ['category'],
                    'category': ['categories'],
                    'leavetype': ['leave-types', 'leave_types', 'leave-type', 'leave_type', 'leavetypes'],
                    'leave-types': ['leavetype', 'leave_types', 'leave-type', 'leave_type'],
                    'reqs': ['leave-requests', 'leave_requests', 'leave-request', 'leave_request', 'leaverequests'],
                    'leave-requests': ['reqs', 'leave_requests', 'leave-request', 'leave_request'],
                }
                for alias in code_aliases.get(code, []):
                    if alias not in permissions_dict:
                        permissions_dict[alias] = merged

    from .models import Menu, SubMenu, SubSubMenu
    all_menus = Menu.objects.all()
    all_submenus = SubMenu.objects.select_related('menu').all()
    all_subsubmenus = SubSubMenu.objects.select_related('submenu', 'submenu__menu').all()

    for ssm in all_subsubmenus:
        actions_list = []
        if ssm.id in explicit_subsubmenu_perms:
            actions_list.extend(explicit_subsubmenu_perms[ssm.id])
            
        if actions_list:
            actions = _merge_actions(actions_list)
            _add_to_dict('subsubmenu', ssm.id, ssm.code, actions)
            
            # Bottom-up inheritance: if a sub-submenu is visible, its parent submenu must be visible
            if actions.get('view') and ssm.submenu_id:
                if ssm.submenu_id not in explicit_submenu_perms:
                    explicit_submenu_perms[ssm.submenu_id] = []
                explicit_submenu_perms[ssm.submenu_id].append({'view': True})

    for sm in all_submenus:
        actions_list = []
        if sm.id in explicit_submenu_perms:
            actions_list.extend(explicit_submenu_perms[sm.id])
            
        if actions_list:
            actions = _merge_actions(actions_list)
            _add_to_dict('submenu', sm.id, sm.code, actions)
            
            # Bottom-up inheritance: if a submenu is visible, its parent menu must be visible
            if actions.get('view') and sm.menu_id:
                if sm.menu_id not in explicit_menu_perms:
                    explicit_menu_perms[sm.menu_id] = []
                explicit_menu_perms[sm.menu_id].append({'view': True})

    for m in all_menus:
        if m.id in explicit_menu_perms:
            actions = _merge_actions(explicit_menu_perms[m.id])
            _add_to_dict('menu', m.id, m.code, actions)

    return permissions_dict

from django.contrib import admin
from production_app.models import (
    EmployeeGroup, EmployeeGroupMember, Shift, ProductionLine, 
    ShiftPlan, ShiftPlanDay, ShiftProductionLine, ShiftProductionEmployee,
    ProductionAttendance, ProductionBreakLog
)

admin.site.register(EmployeeGroup)
admin.site.register(EmployeeGroupMember)
admin.site.register(Shift)
admin.site.register(ProductionLine)
admin.site.register(ShiftPlan)
admin.site.register(ShiftPlanDay)
admin.site.register(ShiftProductionLine)
admin.site.register(ShiftProductionEmployee)
admin.site.register(ProductionAttendance)
admin.site.register(ProductionBreakLog)

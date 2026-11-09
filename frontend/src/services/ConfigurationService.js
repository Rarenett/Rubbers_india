import axiosInstance from './AxiosInstance';

const CONFIG_API_BASE = '/api/configuration';

export const getConfigurableModels = async () => {
    try {
        const response = await axiosInstance.get(`${CONFIG_API_BASE}/models/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching configurable models:', error);
        throw error;
    }
};

export const getModelFields = async (appLabel, modelName) => {
    try {
        const response = await axiosInstance.get(`${CONFIG_API_BASE}/fields/?app_label=${appLabel}&model_name=${modelName}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching model fields:', error);
        throw error;
    }
};

export const FORM_REGISTRY = {
    // Assets App
    "assets_storageroom": [
        { value: "RoomForm", label: "Storage Room Form (RoomForm.jsx)" }
    ],
    "assets_shelf": [
        { value: "ShelfForm", label: "Shelf Form (ShelfForm.jsx)" }
    ],
    "assets_rack": [
        { value: "RackForm", label: "Rack Form (RackForm.jsx)" }
    ],
    "assets_assettype": [
        { value: "AssetTypeForm", label: "Asset Type Form (AssetTypeForm.jsx)" }
    ],
    "assets_assetcategory": [
        { value: "AssetCategoryForm", label: "Asset Category Form (AssetCategoryForm.jsx)" }
    ],
    "assets_asset": [
        { value: "AssetForm", label: "Asset Form (AssetForm.jsx)" }
    ],
    "assets_file": [
        { value: "FileForm", label: "File Form (FileForm.jsx)" }
    ],
    "assets_key": [
        { value: "KeyForm", label: "Key Form (KeyForm.jsx)" }
    ],
    "assets_assetattributedefinition": [
        { value: "AssetAttributeForm", label: "Asset Attribute Form (AssetAttributeForm.jsx)" }
    ],

    // Machine App
    "machine_app_repairpart": [
        { value: "RepairPartForm", label: "Repair Part Form (RepairPartForm.jsx)" }
    ],
    "machine_app_machinedatacollection": [
        { value: "MachineVoucherList", label: "Machine Voucher Form (MachineVoucherList.jsx)" }
    ],
    "machine_app_lifespan": [
        { value: "LifespanList", label: "Lifespan Form (LifespanList.jsx)" }
    ],
    "machine_app_sparepart": [
        { value: "SparePartList", label: "Spare Part Form (SparePartList.jsx)" }
    ],
    "machine_app_categoryname": [
        { value: "CategoryNameList", label: "Category Form (CategoryNameList.jsx)" }
    ],
    "machine_app_subcategoryname": [
        { value: "SubCategoryNameList", label: "Subcategory Form (SubCategoryNameList.jsx)" }
    ],
    "machine_app_typename": [
        { value: "TypeNameFormModal", label: "Type Name Form (TypeNameFormModal.jsx)" }
    ],
    "machine_app_repairrequest": [
        { value: "RepairRequestList", label: "Create Repair Request Form (RepairRequestList.jsx)" },
        { value: "RepairRequestReviewList", label: "Repair Request Review Form (RepairRequestReviewList.jsx)" }
    ],
    "machine_app_processname": [
        { value: "ProcessNameList", label: "Process Name Form (ProcessNameList.jsx)" }
    ],
    "machine_app_machineproductmapping": [
        { value: "MachineProductMappingList", label: "Machine Product Mapping Form (MachineProductMappingList.jsx)" }
    ],
    "machine_app_machineoutput": [
        { value: "MachineOutputList", label: "Machine Output Form (MachineOutputList.jsx)" }
    ],

    // Logistics App
    "logistics_app_servicetype": [
        { value: "Servicetypeform", label: "Service Type Form (Servicetypeform.jsx)" }
    ],
    "logistics_app_driver": [
        { value: "DriverForm", label: "Driver Form (DriverForm.jsx)" }
    ],
    "logistics_app_vehicle": [
        { value: "VehicleForm", label: "Vehicle Form (Vehicleform.jsx)" }
    ],
    "logistics_app_vehicle_category": [
        { value: "Vehiclecategoryform", label: "Vehicle Category Form (Vehiclecategoryform.jsx)" }
    ],
    "logistics_app_vehiclehistory": [
        { value: "Vehiclehistoryform", label: "Vehicle History Form (Vehiclehistoryform.jsx)" }
    ],

    // Finance App
    "finance_app_vouchertype": [
        { value: "VoucherTypeForm", label: "Voucher Type Form (VoucherTypeForm.jsx)" }
    ],
    "finance_app_quotation": [
        { value: "QuotationForm", label: "Quotation Form (QuotationForm.jsx)" }
    ],
    "finance_app_stockjournal": [
        { value: "StockJournalFormModal", label: "Stock Journal Form (StockJournalFormModal.jsx)" }
    ],

    // Sales App
    "sales_app_salesorder": [
        { value: "SalesOrderForm", label: "Sales Order Form (SalesOrderForm.jsx)" }
    ],
    "sales_app_salesreturn": [
        { value: "SalesReturnForm", label: "Sales Return Form (SalesReturnForm.jsx)" }
    ],

    // Purchase App
    "purchase_app_purchaseorder": [
        { value: "PurchaseOrderForm", label: "Purchase Order Form (PurchaseOrderForm.jsx)" }
    ],
    "purchase_app_purchaseinvoice": [
        { value: "Purchaseinvoiceform", label: "Purchase Invoice Form (Purchaseinvoiceform.jsx)" }
    ],
    "purchase_app_purchasereturn": [
        { value: "PurchaseReturnForm", label: "Purchase Return Form (PurchaseReturnForm.jsx)" }
    ],

    // Inventory App
    "inventory_app_stockgroup": [
        { value: "StockGroupFormModal", label: "Stock Group Form (StockGroupFormModal.jsx)" }
    ],
    "inventory_app_stockcategory": [
        { value: "StockCategoryFormModal", label: "Stock Category Form (StockCategoryFormModal.jsx)" }
    ],
    "inventory_app_physicalstock": [
        { value: "PhysicalStockForm", label: "Physical Stock Form (PhysicalStockForm.jsx)" }
    ],
    "inventory_app_productconfiguration": [
        { value: "ProductConfigurationForm", label: "Product Configuration Form (ProductConfigurationForm.jsx)" }
    ],

    // Register / User App
    "register_app_customuser": [
        { value: "UserForm", label: "User Form (UserForm.jsx)" }
    ],

    // CRM App
    "crm_app_lead": [
        { value: "LeadCreate", label: "Lead Create Form (LeadCreate.jsx)" }
    ],

    // HR App
    "hr_app_candidate": [
        { value: "CandidateFormModal", label: "Candidate Form (CandidateFormModal.jsx)" }
    ],
    "hr_app_customer": [
        { value: "CustomerForm", label: "Customer Form (CustomerForm.jsx)" }
    ],
    "rarenett_app_department": [
        { value: "DepartmentFormModal", label: "Department Form (DepartmentFormModal.jsx)" }
    ],
    "rarenett_app_designation": [
        { value: "DesignationFormModal", label: "Designation Form (DesignationFormModal.jsx)" }
    ],

    // Production App
    "production_app_employeegroup": [
        { value: "EmployeeGroupForm", label: "Employee Group Form (EmployeeGroupForm.jsx)" }
    ],
    "production_app_shiftplan": [
        { value: "ShiftPlanForm", label: "Shift Plan Form (ShiftPlanForm.jsx)" }
    ],

    // Appointment App
    "appointment_app_appointment": [
        { value: "AppointmentForm", label: "Appointment Form (AppointmentForm.jsx)" }
    ],

    // Complaint App
    "complaint_app_complaint": [
        { value: "ComplaintForm", label: "Complaint Form (ComplaintForm.jsx)" }
    ],

    // Gate App
    "gate_app_gateentry": [
        { value: "GateEntryForm", label: "Gate Entry Form (GateEntryForm.jsx)" }
    ],
    "gate_app_gate": [
        { value: "GateForm", label: "Gate Form (GateForm.jsx)" }
    ],

    // Renewal App
    "renewal_app_renewalsubject": [
        { value: "RenewalSubjectModal", label: "Renewal Subject Form (RenewalSubjectModal.jsx)" }
    ],
    "renewal_app_renewalreminder": [
        { value: "RenewalReminderPopup", label: "Renewal Reminder Form (RenewalReminderPopup.jsx)" },
        { value: "RenewalUpdationModal", label: "Renewal Updation Form (RenewalUpdationModal.jsx)" }
    ]
};

export const getTableConfiguration = async (tableName, formName) => {
    try {
        const response = await axiosInstance.get(`${CONFIG_API_BASE}/settings/?table_name=${tableName}&form_name=${formName}`);
        return response.data;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return null; // No config yet
        }
        console.error('Error fetching table configuration:', error);
        throw error;
    }
};

export const updateTableConfiguration = async (tableName, formName, data) => {
    try {
        const payload = {
            ...data,
            table_name: tableName,
            form_name: formName
        };
        const response = await axiosInstance.put(`${CONFIG_API_BASE}/settings/`, payload);
        return response.data;
    } catch (error) {
        console.error('Error updating table configuration:', error);
        throw error;
    }
};
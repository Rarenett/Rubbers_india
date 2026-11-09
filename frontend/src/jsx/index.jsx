import React, { useContext, useEffect } from "react";
import { Routes, Route, Outlet, useLocation, Navigate } from "react-router-dom";
import { useSelector } from "react-redux";


/// Css
import './index.css'
import './chart.css'
import './step.css'

/// Layout
import Nav from './layouts/nav'
import Footer from './layouts/Footer'

/// Dashboard
import CommonDashboard from "./components/Dashboard/CommonDashboard.jsx";
import CompanyDashboard from "./components/Dashboard/CompanyDashboard.jsx";
import Index from "./components/Dashboard/Index";
import Index2 from "./components/Dashboard/Index2";
import Project from "./components/Dashboard/Project";
import Contacts from "./components/Dashboard/Contacts";
import Kanban from "./components/Dashboard/Kanban";
import DashboardCalendar from "./components/Dashboard/DashboardCalendar";
import Messages from "./components/Dashboard/Messages";
import ChatBox from "./components/Dashboard/ChatBox";
import Task from "./components/Dashboard/Task";
import FileDashboard from "./components/Assets/FileDashboard.jsx";
import AssetManagement from "./components/Assets/AssetManagement.jsx";
import RepairPartForm from "./components/Equipment/RepairPartForm.jsx";
import RepairPartList from "./components/Equipment/RepairPartList.jsx";

/// App
import AppProfile from './components/AppsMenu/AppProfile/AppProfile'
import PostDetails from './components/AppsMenu/AppProfile/PostDetails'
import Compose from './components/AppsMenu/Email/Compose/Compose'
import Inbox from './components/AppsMenu/Email/Inbox/Inbox'
import Read from './components/AppsMenu/Email/Read/Read'
import Calendar from './components/AppsMenu/Calendar/Calendar'

/// Product List
import ProductGrid from './components/AppsMenu/Shop/ProductGrid/ProductGrid'
import ProductList from './components/AppsMenu/Shop/ProductList/ProductList'
import ProductDetail from './components/AppsMenu/Shop/ProductGrid/ProductDetail'
import Checkout from './components/AppsMenu/Shop/Checkout/Checkout'
import Invoice from './components/AppsMenu/Shop/Invoice/Invoice'
import ProductOrder from './components/AppsMenu/Shop/ProductOrder'
import EcomCustomers from './components/AppsMenu/Shop/Customers/Customers'

/// Charts
import RechartJs from './components/charts/rechart'
import ChartJs from './components/charts/Chartjs'
import SparklineChart from './components/charts/Sparkline'
import ApexChart from './components/charts/apexcharts'

/// Bootstrap
import UiAlert from './components/bootstrap/Alert'
import UiAccordion from './components/bootstrap/Accordion'
import UiBadge from './components/bootstrap/Badge'
import UiButton from './components/bootstrap/Button'
import UiModal from './components/bootstrap/Modal'
import UiButtonGroup from './components/bootstrap/ButtonGroup'
import UiListGroup from './components/bootstrap/ListGroup'
import UiCards from './components/bootstrap/Cards'
import UiCarousel from './components/bootstrap/Carousel'
import UiDropDown from './components/bootstrap/DropDown'
import UiPopOver from './components/bootstrap/PopOver'
import UiProgressBar from './components/bootstrap/ProgressBar'
import UiTab from './components/bootstrap/Tab'
import UiPagination from './components/bootstrap/Pagination'
import UiGrid from './components/bootstrap/Grid'
import UiTypography from './components/bootstrap/Typography'

/// Plugins
import Select2 from './components/PluginsMenu/Select2/Select2'
import MainSweetAlert from './components/PluginsMenu/SweetAlert/SweetAlert'
import Toastr from './components/PluginsMenu/Toastr/Toastr'
import JqvMap from './components/PluginsMenu/JqvMap/JqvMap'
import Lightgallery from './components/PluginsMenu/Lightgallery/Lightgallery'


/// Widget
import Widget from './pages/Widget'

/// Table
import BootstrapTable from './components/table/BootstrapTable'
import SortingTable from "./components/table/SortingTable/SortingTable";
import FilteringTable from "./components/table/FilteringTable/FilteringTable";


/// Form
import Element from './components/Forms/Element/Element'
import Wizard from './components/Forms/Wizard/Wizard'
import CkEditor from './components/Forms/CkEditor/CkEditor'
import Pickers from './components/Forms/Pickers/Pickers'
import FormValidation from './components/Forms/FormValidation/FormValidation'

/// Pages
import LockScreen from './pages/LockScreen'
import Error400 from './pages/Error400'
import Error403 from './pages/Error403'
import Error404 from './pages/Error404'
import Error500 from './pages/Error500'
import Error503 from './pages/Error503'
import Todo from './pages/Todo';
import Posts from "./pages/Posts/Posts";
import AppointmentList from "./components/Appointment/AppointmentList";
import ManageMenus from './pages/ManageMenus';
import ManageSubMenus from './pages/ManageSubMenus';
import ManageSubSubMenus from './pages/ManageSubSubMenus';
import ManagePermissions from './pages/ManagePermissions';
import ManageCurrency from './pages/ManageCurrency';
import ManageLanguage from './pages/ManageLanguage';
import ManageCompany from './pages/ManageCompany';
import BranchDetails from './pages/BranchDetails.jsx';
import CompanySettingsDashboard from './pages/CompanySettingsDashboard.jsx';
import SettingsReportView from './pages/SettingsReportView';
import DefaultDashboard from './pages/DefaultDashboard.jsx';
import QuickAccessDashboard from './pages/QuickAccessDashboard.jsx';
import ManagePrefixType from './pages/ManagePrefixType';
import ManagePrefixConfiguration from './pages/ManagePrefixConfiguration';
import ProtectedRoute from './components/ProtectedRoute';

/// HR Management
import CandidateList from './components/HR/Candidates/CandidateList';
import ScheduleInterview from './components/HR/Candidates/ScheduleInterview';
import EmployeeList from './components/HR/Employees/EmployeeList';
import EmployeeReportList from './components/HR/Employees/EmployeeReportList';
import UserReport from './components/HR/Employees/UserReport';

import UserList from './components/HR/Users/UserList';
import UserForm from './components/HR/Users/UserForm';
import StaffList from './components/HR/Staff/StaffList';
import DepartmentList from './components/HR/Masters/DepartmentList';
import DesignationList from './components/HR/Masters/DesignationList';
import DepartmentDesignationList from './components/HR/Masters/DepartmentDesignationList';
import RoleList from './components/HR/Masters/RoleList';
import DashboardList from './components/HR/Masters/DashboardList';
import UnitList from './components/HR/Masters/UnitList';
/// Attendance & Leave
import LeaveTypeList from './components/Attendance/LeaveTypeList';
import LeaveRequestList from './components/Attendance/LeaveRequestList';

/// Payroll
import PayrollUnitList from './components/Payroll/PayrollUnitList';
import PayrollCompoundUnitList from './components/Payroll/PayrollCompoundUnitList';
import AttendanceProductionTypeList from './components/Payroll/AttendanceProductionTypeList';
import CalculationTypeList from './components/Payroll/CalculationTypeList';
import PayHeadList from './components/Payroll/PayHeadList';

import DutyNameList from './components/HR/Masters/DutyNameList';
import ResponsibilityList from './components/HR/Masters/ResponsibilityList';
import AssignDutyForm from './components/HR/Masters/AssignDutyForm';
import AssignDutyList from './components/HR/Masters/AssignDutyList';
import RevokeDuty from './components/HR/Masters/RevokeDuty';
import AssignDutyReport from './components/HR/Reports/AssignDutyReport';
import ResponsibilityReminderList from './components/HR/Masters/ResponsibilityReminderList.jsx';
import MyResponsibilities from './components/HR/Masters/MyResponsibilities.jsx';
import ResponsibilityReport from './components/HR/Reports/ResponsibilityReport.jsx';
import ResponsibilityDetailReport from './components/HR/Reports/ResponsibilityDetailReport.jsx';
import InventoryDashboardStandard from './components/Inventory/InventoryDashboardStandard.jsx';
import InventoryUnitList from './components/Inventory/UnitList.jsx';
import StockGroupList from './components/Inventory/StockGroupList.jsx';
import StockCategoryList from './components/Inventory/StockCategoryList.jsx';
import StockItemList from './components/Inventory/StockItemList.jsx';
import RecipeList from './components/Inventory/RecipeList.jsx';
import RenewalReminderList from './components/Renewal/RenewalReminderList.jsx';
import RenewalSubjectList from './components/Renewal/RenewalSubjectList.jsx';
import RenewalReminderPopup from './components/Renewal/RenewalReminderPopup.jsx';
import RenewalUpdation from './components/Renewal/RenewalUpdation.jsx';
import RenewalReport from './components/Renewal/RenewalReport.jsx';
import RenewalHistoryReport from './components/Renewal/RenewalHistoryReport.jsx';
import Chatbot from './components/Chatbot/Chatbot';
import MeetingCategoryList from './components/Meeting/MeetingMasters/MeetingCategoryList.jsx';
import MeetingRoomList from './components/Meeting/MeetingRoomList.jsx';
import MeetingList from './components/Meeting/MeetingList.jsx';
import ApproverMeetingList from './components/Meeting/ApproverMeetingList.jsx';
import AssignedMeetingList from './components/Meeting/AssignedMeetingList.jsx';
import VirtualMeetingRoom from './components/Meeting/VirtualMeetingRoom.jsx';
import AgendaDecisionPage from './components/Meeting/AgendaDecisionPage.jsx';
import MyTaskList from './components/Meeting/MyTaskList.jsx';
import AllMeetingsReport from './components/Meeting/AllMeetingsReport.jsx';
import PendingMeetingsReport from './components/Meeting/PendingMeetingsReport.jsx';
import ApprovedMeetingsReport from './components/Meeting/ApprovedMeetingsReport.jsx';
import CompletedMeetingsReport from './components/Meeting/CompletedMeetingsReport.jsx';
import UpcomingMeetingsReport from './components/Meeting/UpcomingMeetingsReport.jsx';
import MeetingNotificationPopup from './components/Notification/MeetingNotificationPopup';
import SparePartList from './components/Equipment/SparePartList.jsx';
import LifespanList from './components/Equipment/LifespanList.jsx';
import TypeNameList from './components/Equipment/TypeNameList.jsx';
import CategoryNameList from './components/Equipment/CategoryNameList.jsx';
import SubCategoryNameList from './components/Equipment/SubCategoryNameList.jsx';
import ProcessNameList from './components/Equipment/ProcessNameList.jsx';
import MachineVoucherList from './components/Equipment/MachineVoucherList.jsx';
import RepairRequestList from './components/Equipment/RepairRequestList.jsx';
import RepairRequestReceiverList from './components/Equipment/RepairRequestReceiverList.jsx';
import RepairRequestReviewList from './components/Equipment/RepairRequestReviewList.jsx';
import MachineProductMappingList from './components/Equipment/MachineProductMappingList.jsx';
import MachineOutputList from './components/Equipment/MachineOutputList.jsx';
import DatabaseBackup from './components/Settings/DatabaseBackup.jsx';
import TaskManagementDashboard from './components/TaskManagement/TaskManagementDashboard.jsx';
import TaskReportList from './components/TaskManagement/TaskReportList.jsx';
import TaskAdminDashboard from './components/TaskManagement/TaskAdminDashboard.jsx';
import TaskAdminReportList from './components/TaskManagement/TaskAdminReportList.jsx';
import TaskPostponedReportList from './components/TaskManagement/TaskPostponedReportList.jsx';

import TopPicksMappingManagement from './components/Sales/TopPicksMappingManagement.jsx';



/// CRM
import CrmManagement from './components/Crm/CrmManagement';
import CrmReminderPopup from './components/Crm/CrmReminderPopup';
import CrmDashboard from './components/Crm/CrmDashboard';
import LeadList from './components/Crm/LeadList';
import LeadCreate from './components/Crm/LeadCreate';
import LeadDetail from './components/Crm/LeadDetail';
import LeadListNew from './components/crm_new/LeadList';
import LeadCreateNew from './components/crm_new/LeadCreate';
import LeadDetailNew from './components/crm_new/LeadDetail';
import TeleCallingDashboard from './components/Crm/TeleCallingDashboard';
import TeleCallingDashboardNew from './components/crm_new/TeleCallingDashboard';
import TeleCallingInteraction from './components/Crm/TeleCallingInteraction';
import LeadCategoryManagement from './components/Crm/LeadCategoryManagement';
import LeadSourceList from './components/crm_new/LeadSourceList';
import CrmServiceList from './components/crm_new/CrmServiceList';
import LeadCategoryList from './components/crm_new/LeadCategoryList';
import IndustryList from './components/crm_new/IndustryList';
import CrmOfferList from './components/crm_new/CrmOfferList';
import PurposeList from './components/crm_new/PurposeList';
import PerformanceDashboard from './components/Crm/PerformanceDashboard';
import CallerMyLeads from './components/crm_new/CallerMyLeads';
import ConvertedOpportunities from './components/crm_new/ConvertedOpportunities';
import OpportunityApprovalList from './components/crm_new/OpportunityApprovalList';
import CrmReports from './components/crm_new/CrmReports';
import CrmLeadsReport from './components/crm_new/CrmLeadsReport';
import CrmConvertedLeadsReport from './components/crm_new/CrmConvertedLeadsReport';
import { CrmHeader } from './components/Crm/CrmManagement';

/// Team Management
import TeamManagementDashboard from './components/TeamManagement/TeamManagementDashboard';

/// Production
import EmployeeGroupList from './components/Production/EmployeeGroupList';

/// Access Point

import AccessPointManagement from './components/AccessPoint/AccessPointManagement';
import GateForm from './components/AccessPoint/GateForm';
import CategoryForm from './components/AccessPoint/CategoryForm';
import SubCategoryForm from './components/AccessPoint/SubCategoryForm';
import EntryTagForm from './components/AccessPoint/EntryTagForm';
import VisitorRegistration from './components/AccessPoint/VisitorRegistration';
import GateEntryForm from './components/AccessPoint/GateEntryForm';
import GateEntryDetail from './components/AccessPoint/GateEntryDetail.jsx';
import GateEntryList from './components/AccessPoint/GateEntryList.jsx';
import ParkArea from './components/AccessPoint/ParkArea.jsx';
import ParkingFee from './components/AccessPoint/ParkingFee.jsx';
import EntryCard from './components/AccessPoint/EntryCard.jsx';
import ExitCard from './components/AccessPoint/ExitCard.jsx';
import MyVisitorApprovals from './components/AccessPoint/MyVisitorApprovals.jsx';
import VehicleTypeManagement from './components/AccessPoint/VehicleTypeManagement.jsx';
import ApprovalNotificationPopup from './components/AccessPoint/ApprovalNotificationPopup.jsx';
import VisitorReallocation from './components/AccessPoint/VisitorReallocation.jsx';
import GateEntryReport from './components/AccessPoint/GateEntryReport.jsx';
import ApprovelessEntryConfig from './components/AccessPoint/ApprovelessEntryConfig.jsx';
import EquipmentManagement from './components/AccessPoint/EquipmentManagement.jsx';
import EmployeeVehicleConfig from './components/AccessPoint/EmployeeVehicleConfig.jsx';

/// Complaints
import ComplaintManagement from './components/Complaints/ComplaintManagement.jsx';
import ComplaintDetail from './components/Complaints/ComplaintDetail.jsx';
import ComplaintList from './components/Complaints/ComplaintList.jsx';
import ComplaintForm from './components/Complaints/ComplaintForm.jsx';
import CategoryMatrix from './components/Complaints/CategoryMatrix.jsx';
import CommentPattern from './components/Complaints/CommentPattern.jsx';
import ComplaintFinalDecisionList from './components/Complaints/ComplaintFinalDecisionList.jsx';
import ComplaintFinalDecisionView from './components/Complaints/ComplaintFinalDecisionView.jsx';
import ComplaintResponderView from './components/Complaints/ComplaintResponderView.jsx';

import AdminReviewList from './components/Complaints/AdminReviewList';

//Scroll To Top
import ScrollToTop from './layouts/ScrollToTop';
import { ThemeContext } from "../context/ThemeContext";
import { TaskReminderProvider } from '../context/TaskReminderProvider';

//Logistics

import DriverOperationsScreen from './components/Logistics/DriverOperationsScreen.jsx';
import DriverOrdersScreen from './components/Logistics/DriverOrdersScreen.jsx';
import VehicleCategoryManagement from './components/Logistics/Vehiclecategorymanagement.jsx';
import TyreSizeList from './components/Logistics/TyreSizeList.jsx';
import VehicleManagement from './components/Logistics/Vehiclemanagement.jsx';
import DriverManagement from './components/Logistics/DriverManagement.jsx';
import ServiceTypeManagement from './components/Logistics/Servicetypemanagement.jsx';
import VehicleHistoryManagement from './components/Logistics/Vehiclehistorymanagement.jsx';
import SalesOrderManagement from './components/Sales/SalesOrderManagement.jsx';
import TallySalesOrderSync from './components/Sales/TallySalesOrderSync.jsx';
import TallySalesInvoiceSync from './components/Sales/TallySalesInvoiceSync.jsx';
import TallySalesReturnSync from './components/Sales/TallySalesReturnSync.jsx';
import SalesOrderBulkUpdate from './components/Sales/SalesOrderBulkUpdate.jsx';
import SalesReportList from './components/Sales/SalesReportList.jsx';

import SalesInvoiceReportList from './components/Sales/SalesInvoiceReportList.jsx';
import SalesReturnReportList from './components/Sales/SalesReturnReportList.jsx';
import CustomerSalesInvoiceReportList from './components/Sales/CustomerSalesInvoiceReportList.jsx';
import DistributorSalesInvoiceReportList from './components/Sales/DistributorSalesInvoiceReportList.jsx';
import CustomerSalesReturnReportList from './components/Sales/CustomerSalesReturnReportList.jsx';

import SalesDeliveryReportList from './components/Sales/SalesDeliveryReportList.jsx';
import SalesPendingOrdersReportList from './components/Sales/SalesPendingOrdersReportList.jsx';
import SalesDriverReportList from './components/Sales/SalesDriverReportList.jsx';
import SalesVehicleReportList from './components/Sales/SalesVehicleReportList.jsx';
import SalesCustomerReportList from './components/Sales/SalesCustomerReportList.jsx';
import DistributorSalesReportList from './components/Sales/DistributorSalesReportList.jsx';

// Force dev server reload
import SalesInvoiceForm from "./components/Sales/SalesInvoiceForm";
import SalesOrderManagement_v2 from "./components/Sales/SalesOrderManagement";
import DeliveryLocationManagement from "./components/Sales/DeliveryLocationManagement";
import SalesOrderForm from "./components/Sales/SalesOrderForm";
import SalesInvoiceManagement from './components/Sales/SalesInvoiceManagement.jsx';
import DailyEntryManagement from './components/Sales/DailyEntryManagement.jsx';
import DailyEntryReport from './components/Sales/DailyEntryReport.jsx';

import SalesReturnManagement from './components/Sales/Salesreturnmanagement.jsx';
import DistributorSalesOrder from './components/Sales/DistributorSalesOrder.jsx';

import MarketingConnectDashboard from './components/MarketingConnect/MarketingConnectDashboard.jsx';
import MarketingConnectLogin from './components/MarketingConnect/MarketingConnectLogin.jsx';
import AttendanceModule from './components/MarketingConnect/AttendanceModule.jsx';
import MarketingAttendanceReport from './components/MarketingConnect/MarketingAttendanceReport.jsx';
import MarketingVisitReport from './components/MarketingConnect/MarketingVisitReport.jsx';
import MarketingFollowUpReport from './components/MarketingConnect/MarketingFollowUpReport.jsx';
import MarketingExecutiveVisitReport from './components/MarketingConnect/MarketingExecutiveVisitReport.jsx';
import OfflineAttendanceModule from './components/MarketingConnect/OfflineAttendanceModule.jsx';
import TransportModule from './components/MarketingConnect/TransportModule.jsx';
import ShopVisitModule from './components/MarketingConnect/ShopVisitModule.jsx';
import OrdersModule from './components/MarketingConnect/OrdersModule.jsx';
import MarketingConnectOrdersList from './components/MarketingConnect/MarketingConnectOrdersList.jsx';
import LeadsModule from './components/MarketingConnect/LeadsModule.jsx';
import DistributorOrdersList from './components/Sales/DistributorOrdersList.jsx';
import SupplierOrdersList from './components/Purchase/SupplierOrdersList.jsx';


import PriceList from './components/Inventory/PriceList.jsx';
import PriceListMapping from './components/Inventory/PriceListMapping.jsx';
import ProductConfigurationManagement from './components/Inventory/ProductConfigurationManagement.jsx';
import PhysicalStockManagement from './components/Inventory/PhysicalStockManagement.jsx';
import StockReportsManagement from "./components/Inventory/Reports/StockReportsManagement";
import ItemReport from "./components/Inventory/Reports/ItemReport";
import GodownReport from "./components/Inventory/Reports/GodownReport";
import BatchwiseReport from "./components/Inventory/Reports/BatchwiseReport";
import StockItemBook from "./components/Inventory/Reports/StockItemBook";
import WarehouseTransferManagement from './components/Inventory/WarehouseTransferManagement.jsx';
import ItemMovementReportList from './components/Inventory/ItemMovementReportList.jsx';
import DriverAuditLogManagement from './components/Logistics/DriverAuditLogManagement.jsx';
import VehicleAuditLogManagement from './components/Logistics/VehicleAuditLogManagement';
import VehicleHistoryAuditLogManagement from './components/Logistics/VehicleHistoryAuditLogManagement';
import FinesAndTokensScreen from './components/Logistics/FinesAndTokensScreen.jsx';
import DemoTableConfiguration from './components/Logistics/TableConfiguration.jsx';
import MachineDataCollectionConfiguration from './components/Logistics/MachineDataCollectionConfiguration.jsx';
import DynamicFormConfiguration from './components/Configuration/DynamicFormConfiguration.jsx';
import InactivityTimeoutSettings from './components/Configuration/InactivityTimeoutSettings.jsx';
import RouteMasterManagement from "./components/Logistics/RouteMasterManagement";
import RouteStopsManagement from "./components/Logistics/RouteStopsManagement";
import RouteStopMasterManagement from "./components/Logistics/RouteStopMasterManagement";
import AreaCreation from './components/CommonMaster/AreaCreation';
import AreaLocationMapping from './components/CommonMaster/AreaLocationMapping';
import SalesmanMapping from './components/CommonMaster/SalesmanMapping';
import SalesmanVisitings from './components/CommonMaster/SalesmanVisitings';
import TripMasterManagement from "./components/Logistics/TripMasterManagement";
import PackageTypeManagement from './components/Logistics/PackageTypeManagement.jsx';
import ItemSpecificationManagement from './components/Logistics/ItemSpecificationManagement.jsx';
import TripLoadingScreen from './components/Logistics/TripLoadingScreen.jsx';
import DistributionZoneList from './components/Crm/DistributionZoneList.jsx';
import DistributionHub from './components/Crm/DistributionHub';
import DistributorLead from './components/Crm/DistributorLead';
import PartnerLeadsList from './components/Crm/PartnerLeadsList';
import VendorLead from './components/Crm/VendorLead';

/// Finance
import FinanceDashboard from './components/Finance/FinanceDashboard.jsx';
import AccountGroupList from './components/Finance/AccountGroupList.jsx';
import ShiftPlanManagement from './components/Production/ShiftPlanManagement.jsx';
import ShiftPlanForm from './components/Production/ShiftPlanForm.jsx';
import ShiftList from './components/Production/ShiftList.jsx';
import ProductionLineList from './components/Production/ProductionLineList.jsx';
import AttendanceBreakMarkingPage from './components/Production/AttendanceBreakMarkingPage.jsx';
import BreakTypeMasterList from './components/Production/BreakTypeMasterList.jsx';
import EmployeeAttendanceReport from './components/Production/EmployeeAttendanceReport.jsx';
import PostProductionEntryPage from './components/Production/PostProductionEntryPage.jsx';
import AssignPostProductionResponsibility from './components/Production/AssignPostProductionResponsibility.jsx';
import AdjustmentsPage from './components/Production/AdjustmentsPage.jsx';
import RnDEntryPage from './components/RnD/RnDEntryPage.jsx';
import LedgerList from './components/Finance/LedgerList.jsx';
import LedgerDetailsPage from './components/Finance/LedgerDetailsPage.jsx';
import FactoryDetails from './pages/FactoryDetails.jsx';
import WarehouseDetails from './pages/WarehouseDetails.jsx';


// Force dev server reload
import ServiceInvoice from './components/Finance/ServiceInvoice.jsx';
import JournalList from './components/Finance/JournalList.jsx';
import ReceiptList from './components/Finance/ReceiptList.jsx';
import PaymentList from './components/Finance/PaymentList.jsx';
import ContraList from './components/Finance/ContraList.jsx';
import JournalList_new from './components/Finance/JournalList_new.jsx';
import ReceiptList_new from './components/Finance/ReceiptList_new.jsx';
import PaymentList_new from './components/Finance/PaymentList_new.jsx';
import ContraList_new from './components/Finance/ContraList_new.jsx';
import StockJournalTypeList from './components/Finance/StockJournalTypeList.jsx';
import StockJournalList from './components/Finance/StockJournalList.jsx';
import ManufacturalJournalTypeList from './components/Finance/ManufacturalJournalTypeList.jsx';
import ManufacturalJournalList from './components/Finance/ManufacturalJournalList.jsx';
import QuotationManagement from './components/Finance/QuotationManagement.jsx';
import VoucherTypeManagement from './components/Finance/VoucherTypeManagement.jsx';
import TrialBalance from './components/Finance/TrialBalance.jsx';
import ProfitAndLoss from './components/Finance/ProfitAndLoss.jsx';
import BalanceSheet from './components/Finance/BalanceSheet.jsx';
import ReceivablesReport from './components/Finance/ReceivablesReport.jsx';
import PayablesReport from './components/Finance/PayablesReport.jsx';
import DayBook from './components/Finance/DayBook.jsx';
import LedgerBook from './components/Finance/LedgerBook.jsx';


///Purchase
import PurchaseOrderManagement from './components/Purchase/PurchaseOrderManagement.jsx';
import SupplierPurchaseOrder from './components/Purchase/SupplierPurchaseOrder.jsx';
import PurchaseInvoiceManagement from './components/Purchase/Purchaseinvoicemanagement.jsx';
import PurchaseReturnManagement from './components/Purchase/Purchasereturnmanagement.jsx';
import PurchaseOrderReport from './components/Purchase/PurchaseOrderReport.jsx';
import PurchaseReturnReport from './components/Purchase/PurchaseReturnReport_new.jsx';
import PurchaseInvoiceReport from './components/Purchase/PurchaseInvoiceReport.jsx';
import SupplierWisePOReport from './components/Purchase/SupplierWisePOReport.jsx';
import SupplierWisePIReport from './components/Purchase/SupplierWisePIReport.jsx';
import SupplierWisePRReport from './components/Purchase/SupplierWisePRReport.jsx';

/// Dynamic Database Designer
import TableList from './components/DynamicDB/TableList';
import CreateTable from './components/DynamicDB/CreateTable';
import EditTable from './components/DynamicDB/EditTable';
import DynamicDataGrid from './components/DynamicDB/DynamicDataGrid';

import CustomerType from './components/HR/Customers/CustomerType';
import CustomerList from './components/HR/Customers/CustomerList';

import TallyPurchaseInvoiceSync from './components/Purchase/TallyPurchaseInvoiceSync.jsx';
import TallyPurchaseReturnSync from './components/Purchase/TallyPurchaseReturnSync.jsx';

//TASK

import TaskCategoryList from './components/Task/TaskCategoryList.jsx';
import TaskSubCategoryList from './components/Task/TaskSubCategoryList.jsx';
import TaskListPage from "./components/Task/TaskListPage.jsx";
import SubtaskListPage from "./components/Task/SubtaskListPage.jsx";
import AssignTaskVotePage from "./components/Task/AssignTaskVotePage.jsx";
import MyPendingVotesPage from './components/Task/MyPendingVotesPage';
import MyAssignedTasksPage from './components/Task/MyAssignedTasksPage';
import AssignTaskPage from './components/Task/Assigntaskpage';
import TaskProgressUpdatePage from './components/Task/TaskProgressUpdatePage';
import MyTaskReportPage from './components/Task/Mytaskreportpage.jsx';
import NotVotedTasksReportPage from './components/Task/Notvotedtasksreportpage';
import NotStartedTasksReportPage from './components/Task/Notstartedtasksreportpage';
import MyVotesPage from './components/MyVotes/MyVotesPage';

/// Wallet Module
import WalletMaster from './components/Wallet/WalletMaster.jsx';
import WalletTransactions from './components/Wallet/WalletTransactions.jsx';
import WalletCreation from './components/Wallet/WalletCreation.jsx';
import WalletPointsEntry from './components/Wallet/WalletPointsEntry.jsx';
import WalletReport from './components/Wallet/WalletReport.jsx';
import WalletOwnerType from './components/Wallet/WalletOwnerType.jsx';
import WalletSchemes from './components/Wallet/WalletSchemes.jsx';
import WalletReason from './components/Wallet/WalletReason.jsx';
import WalletWorking from './components/Wallet/WalletWorking.jsx';
import WalletCalendar from './components/Wallet/WalletCalendar.jsx';
import InactivityTracker from './components/Wallet/InactivityTracker.jsx';

/// DigiLocker Module
import FolderCreation from './components/DigiLocker/FolderCreation.jsx';
import UploadFiles from './components/DigiLocker/UploadFiles.jsx';
import DigiLockerMapping from './components/DigiLocker/DigiLockerMapping.jsx';
import DigiLockerAccess from './components/DigiLocker/DigiLockerAccess.jsx';
import DigiLockerReport from './components/DigiLocker/DigiLockerReport.jsx';
import FilesViewReport from './components/DigiLocker/FilesViewReport.jsx';
import FileDownloadReport from './components/DigiLocker/FileDownloadReport.jsx';
import FileApproval from './components/DigiLocker/FileApproval.jsx';

// Wrapper that renders the CRM header + tab-bar above any dedicated CRM page component.
// This replaces the old CrmManagement shell for the new individual URL routes.
const CrmPage = ({ children }) => (
  <div className="crm-management-container" style={{ minHeight: '100vh', backgroundColor: 'var(--crm-bg, #f8fafd)' }}>
    <CrmHeader />
    <div className="crm-tab-content">{children}</div>
  </div>
);

const DefaultDashboardRedirect = () => {
  const { auth } = useSelector(state => state.auth || {});
  const storedUser = (() => {
    try {
      const details = localStorage.getItem('userDetails');
      return details ? JSON.parse(details)?.user || JSON.parse(details) : null;
    } catch {
      return null;
    }
  })();
  const user = auth?.user || storedUser || {};
  const defaultDashboard = user?.role?.assigned_dashboards?.find(d => d.is_default);
  const firstDashboard = user?.role?.assigned_dashboards?.[0];
  let roleTargetUrl = defaultDashboard ? defaultDashboard.route : (firstDashboard ? firstDashboard.route : null);
  if (roleTargetUrl && !roleTargetUrl.startsWith('/')) {
    roleTargetUrl = '/' + roleTargetUrl;
  }

  if (roleTargetUrl && roleTargetUrl !== '/' && roleTargetUrl !== '') {
    return <Navigate to={roleTargetUrl} replace />;
  }

  return <Navigate to="/dashboard" replace />;
};

const Markup = () => {


  const allroutes = [
    { url: 'customer-types', component: <CustomerType /> },
    { url: 'customer-creation', component: <CustomerList /> },
    { url: 'stock-reports', component: <StockReportsManagement /> },
    { url: 'stock-reports/:type', component: <StockReportsManagement /> },
    { url: 'item-report', component: <ItemReport /> },
    { url: 'godown-report', component: <GodownReport /> },
    { url: 'batchwise-report', component: <BatchwiseReport /> },];
  allroutes.push(
    /// Dashboard
    { url: "common-dashboard", component: <CompanyDashboard /> },
    { url: "Common-Dashboard", component: <CompanyDashboard /> },
    { url: "", component: <DefaultDashboardRedirect /> },
    { url: "default-dashboard", component: <DefaultDashboard allroutes={allroutes} /> },
    { url: "quick-access-dashboard", component: <QuickAccessDashboard allroutes={allroutes} /> },
    { url: "dashboard", component: <CommonDashboard /> },
    { url: "dashboard-dark", component: <Index2 /> },
    { url: "projects", component: <Project /> },
    { url: "contacts", component: <Contacts /> },
    { url: "task-list", component: <Kanban /> },
    { url: "calendar", component: <DashboardCalendar /> },
    { url: "messages", component: <Messages /> },
    { url: "chatbox", component: <ChatBox /> },
    { url: 'task', component: <Task /> },
    { url: 'file-dashboard', component: <FileDashboard /> },
    { url: 'asset-management/all', component: <AssetManagement /> },
    { url: 'asset-management/Room', component: <AssetManagement /> },
    { url: 'asset-management/Shelf', component: <AssetManagement /> },
    { url: 'asset-management/Rack', component: <AssetManagement /> },
    { url: 'asset-management/type', component: <AssetManagement /> },
    { url: 'asset-management/File', component: <AssetManagement /> },
    { url: 'asset-management/Key', component: <AssetManagement /> },
    { url: 'asset-management/Asset', component: <AssetManagement /> },
    { url: 'asset-management/asset', component: <AssetManagement /> },
    { url: 'asset-management/AssetCategory', component: <AssetManagement /> },
    { url: 'asset-management/assetattributedefinition', component: <AssetManagement /> },
    { url: 'asset-management/Allocation', component: <AssetManagement /> },
    { url: 'asset-management/key allocation', component: <AssetManagement /> },
    { url: 'asset-management/key report', component: <AssetManagement /> },
    { url: 'asset-management/report', component: <AssetManagement /> },
    { url: 'asset-management/:type', component: <AssetManagement /> },

    /// Apps
    { url: 'app-profile', component: <AppProfile /> },
    { url: 'post-details', component: <PostDetails /> },
    { url: 'email-compose', component: <Compose /> },
    { url: 'email-inbox', component: <Inbox /> },
    { url: 'email-read', component: <Read /> },
    { url: 'email-read/:id', component: <Read /> },
    { url: 'app-calender', component: <Calendar /> },


    /// Chart
    { url: 'chart-sparkline', component: <SparklineChart /> },
    { url: 'chart-chartjs', component: <ChartJs /> },
    { url: 'chart-apexchart', component: <ApexChart /> },
    { url: 'chart-rechart', component: <RechartJs /> },

    /// Bootstrap
    { url: 'ui-alert', component: <UiAlert /> },
    { url: 'ui-badge', component: <UiBadge /> },
    { url: 'ui-button', component: <UiButton /> },
    { url: 'ui-modal', component: <UiModal /> },
    { url: 'ui-button-group', component: <UiButtonGroup /> },
    { url: 'ui-accordion', component: <UiAccordion /> },
    { url: 'ui-list-group', component: <UiListGroup /> },
    { url: 'ui-card', component: <UiCards /> },
    { url: 'ui-carousel', component: <UiCarousel /> },
    { url: 'ui-dropdown', component: <UiDropDown /> },
    { url: 'ui-popover', component: <UiPopOver /> },
    { url: 'ui-progressbar', component: <UiProgressBar /> },
    { url: 'ui-tab', component: <UiTab /> },
    { url: 'ui-pagination', component: <UiPagination /> },
    { url: 'ui-typography', component: <UiTypography /> },
    { url: 'ui-grid', component: <UiGrid /> },

    /// Plugin
    { url: 'uc-select2', component: <Select2 /> },
    { url: 'uc-sweetalert', component: <MainSweetAlert /> },
    { url: 'uc-toastr', component: <Toastr /> },
    { url: 'map-jqvmap', component: <JqvMap /> },
    { url: 'uc-lightgallery', component: <Lightgallery /> },


    /// Widget
    { url: 'widget-basic', component: <Widget /> },

    /// Shop
    { url: 'ecom-product-grid', component: <ProductGrid /> },
    { url: 'ecom-product-list', component: <ProductList /> },
    { url: 'ecom-product-detail', component: <ProductDetail /> },
    { url: 'ecom-product-order', component: <ProductOrder /> },
    { url: 'ecom-checkout', component: <Checkout /> },
    { url: 'ecom-invoice', component: <Invoice /> },
    { url: 'ecom-product-detail', component: <ProductDetail /> },
    { url: 'ecom-customers', component: <EcomCustomers /> },

    /// Form    
    { url: 'form-element', component: <Element /> },
    { url: 'form-wizard', component: <Wizard /> },
    { url: 'form-editor', component: <CkEditor /> },
    { url: 'form-pickers', component: <Pickers /> },
    { url: 'form-validation', component: <FormValidation /> },

    /// table
    { url: 'table-bootstrap-basic', component: <BootstrapTable /> },
    { url: 'table-filtering', component: <FilteringTable /> },
    { url: 'table-sorting', component: <SortingTable /> },

    /// pages    
    { url: 'page-lock-screen', component: <LockScreen /> },
    { url: 'page-error-400', component: <Error400 /> },
    { url: 'page-error-403', component: <Error403 /> },
    { url: 'page-error-404', component: <Error404 /> },
    { url: 'page-error-500', component: <Error500 /> },
    { url: 'page-error-503', component: <Error503 /> },
    { url: 'todo', component: <Todo /> },
    { url: "posts", component: <Posts /> },

    /// HR Management
    { url: 'hr/candidates', component: <ProtectedRoute module="candidates" action="view"><CandidateList /></ProtectedRoute> },
    { url: 'hr/schedule-interview', component: <ProtectedRoute module="candidates" action="edit"><ScheduleInterview /></ProtectedRoute> },
    { url: 'hr/employees', component: <ProtectedRoute module="employees" action="view"><EmployeeList /></ProtectedRoute> },
    { url: 'hr/employee-report', component: <ProtectedRoute module="employees" action="view"><EmployeeReportList /></ProtectedRoute> },
    { url: 'hr/user-report', component: <ProtectedRoute module="employees" action="view"><UserReport /></ProtectedRoute> },

    { url: 'hr/users', component: <ProtectedRoute module="bod_users" action="view"><UserList /></ProtectedRoute> },
    { url: 'hr/users/add', component: <ProtectedRoute module="bod_users" action="create"><UserForm /></ProtectedRoute> },
    { url: 'hr/users/edit/:id', component: <ProtectedRoute module="bod_users" action="edit"><UserForm /></ProtectedRoute> },
    { url: 'hr/staff', component: <ProtectedRoute module="staff" action="view"><StaffList /></ProtectedRoute> },
    { url: 'hr/departments', component: <ProtectedRoute module="department" action="view"><DepartmentList /></ProtectedRoute> },
    { url: 'hr/designations', component: <ProtectedRoute module="designations" action="view"><DesignationList /></ProtectedRoute> },
    { url: 'hr/department-designations', component: <ProtectedRoute module="department-designation" action="view"><DepartmentDesignationList /></ProtectedRoute> },
    { url: 'hr/roles', component: <ProtectedRoute module="roles" action="view"><RoleList /></ProtectedRoute> },
    { url: 'hr/dashboards', component: <ProtectedRoute module="roles" action="view"><DashboardList /></ProtectedRoute> },
    { url: 'hr/responsibility-reminders', component: <ProtectedRoute module="hr" action="view"><ResponsibilityReminderList /></ProtectedRoute> },
    { url: 'hr/my-responsibilities', component: <ProtectedRoute module="hr" action="view"><MyResponsibilities /></ProtectedRoute> },
    { url: 'hr/responsibility-report', component: <ProtectedRoute module="hr" action="view"><ResponsibilityReport /></ProtectedRoute> },
    { url: 'hr/responsibility-detail-report', component: <ProtectedRoute module="hr" action="view"><ResponsibilityDetailReport /></ProtectedRoute> },

    /// Attendance & Leave
    { url: 'attendance/leave-types', component: <LeaveTypeList /> },
    { url: 'attendance/leave-types/', component: <LeaveTypeList /> },
    { url: 'hr/leave-types', component: <LeaveTypeList /> },
    { url: 'hr/leave-types/', component: <LeaveTypeList /> },
    { url: 'attendance/leave-requests', component: <LeaveRequestList /> },
    { url: 'attendance/leave-requests/', component: <LeaveRequestList /> },
    { url: 'hr/leave-requests', component: <LeaveRequestList /> },
    { url: 'hr/leave-requests/', component: <LeaveRequestList /> },

    /// Payroll
    { url: 'payroll/units', component: <PayrollUnitList /> },
    { url: 'payroll/compound-units', component: <PayrollCompoundUnitList /> },
    { url: 'payroll/attendance-production-types', component: <AttendanceProductionTypeList /> },
    { url: 'payroll/calculation-types', component: <CalculationTypeList /> },
    { url: 'payroll/calculationtypes', component: <CalculationTypeList /> },
    { url: 'payroll/pay-heads', component: <PayHeadList /> },
    { url: 'payroll/payheads', component: <PayHeadList /> },

    { url: 'Inventory/dashboard', component: <ProtectedRoute module="inventory" action="view"><InventoryDashboardStandard /></ProtectedRoute> },
    { url: 'inventory/dashboard', component: <ProtectedRoute module="inventory" action="view"><InventoryDashboardStandard /></ProtectedRoute> },
    { url: 'Inventory/units', component: <ProtectedRoute module="units" action="view"><InventoryUnitList /></ProtectedRoute> },
    { url: 'inventory/units', component: <ProtectedRoute module="units" action="view"><InventoryUnitList /></ProtectedRoute> },
    { url: 'Inventory/stock-groups', component: <ProtectedRoute module="stock_group" action="view"><StockGroupList /></ProtectedRoute> },
    { url: 'inventory/stock-groups', component: <ProtectedRoute module="stock_group" action="view"><StockGroupList /></ProtectedRoute> },
    { url: 'Inventory/stock-categories', component: <ProtectedRoute module="stock_category" action="view"><StockCategoryList /></ProtectedRoute> },
    { url: 'inventory/stock-categories', component: <ProtectedRoute module="stock_category" action="view"><StockCategoryList /></ProtectedRoute> },
    { url: 'Inventory/stock-items', component: <ProtectedRoute module="stock_item" action="view"><StockItemList /></ProtectedRoute> },
    { url: 'inventory/stock-items', component: <ProtectedRoute module="stock_item" action="view"><StockItemList /></ProtectedRoute> },
    { url: 'Inventory/recipes', component: <ProtectedRoute module="bom" action="view"><RecipeList /></ProtectedRoute> },
    { url: 'inventory/recipes', component: <ProtectedRoute module="bom" action="view"><RecipeList /></ProtectedRoute> },

    { url: 'renewal/reminders', component: <ProtectedRoute module="reminders" action="view"><RenewalReminderList /></ProtectedRoute> },
    { url: 'renewal/subjects', component: <ProtectedRoute module="reminders" action="view"><RenewalSubjectList /></ProtectedRoute> },
    { url: 'renewal/updation', component: <ProtectedRoute module="reminders" action="view"><RenewalUpdation /></ProtectedRoute> },
    { url: 'renewal/reports', component: <ProtectedRoute module="reminders" action="view"><RenewalReport /></ProtectedRoute> },
    { url: 'renewal/history-report', component: <ProtectedRoute module="reminders" action="view"><RenewalHistoryReport /></ProtectedRoute> },

    /// Team Management
    { url: 'team-management/create', component: <ProtectedRoute module="teams" action="create"><TeamManagementDashboard /></ProtectedRoute> },

    /// Production
    { url: 'production/employee-groups', component: <ProtectedRoute module="shift_group" action="view"><EmployeeGroupList /></ProtectedRoute> },

    /// Meeting Management
    { url: 'meeting/categories', component: <ProtectedRoute module="meeting-categories" action="view"><MeetingCategoryList /></ProtectedRoute> },
    { url: 'meeting/rooms', component: <ProtectedRoute module="meeting-rooms" action="view"><MeetingRoomList /></ProtectedRoute> },
    { url: 'meeting/list', component: <ProtectedRoute module="meetings" action="view"><MeetingList /></ProtectedRoute> },
    { url: 'meeting/assigned', component: <ProtectedRoute module="meetings" action="view"><AssignedMeetingList /></ProtectedRoute> },
    { url: 'meeting/virtual-room/:id', component: <ProtectedRoute module="meetings" action="view"><VirtualMeetingRoom /></ProtectedRoute> },
    { url: 'meeting/agenda-decisions/:id', component: <ProtectedRoute module="meetings" action="edit"><AgendaDecisionPage /></ProtectedRoute> },
    { url: 'meeting/approver-list', component: <ProtectedRoute module="meetings" action="approve"><ApproverMeetingList /></ProtectedRoute> },
    { url: 'meeting/my-tasks', component: <ProtectedRoute module="meetings" action="view"><MyTaskList /></ProtectedRoute> },
    { url: 'meeting/reports/all', component: <ProtectedRoute module="meetings" action="view"><AllMeetingsReport /></ProtectedRoute> },
    { url: 'meeting/reports/pending', component: <ProtectedRoute module="meetings" action="view"><PendingMeetingsReport /></ProtectedRoute> },
    { url: 'meeting/reports/approved', component: <ProtectedRoute module="meetings" action="view"><ApprovedMeetingsReport /></ProtectedRoute> },
    { url: 'meeting/reports/completed', component: <ProtectedRoute module="meetings" action="view"><CompletedMeetingsReport /></ProtectedRoute> },
    { url: 'meeting/reports/upcoming', component: <ProtectedRoute module="meetings" action="view"><UpcomingMeetingsReport /></ProtectedRoute> },

    /// Menu Management (Superuser only)
    { url: 'manage-menus', component: <ProtectedRoute requireSuperuser={true} module="settings_menu" action="view"><ManageMenus /></ProtectedRoute> },
    { url: 'manage-submenus', component: <ProtectedRoute requireSuperuser={true} module="settings_submenus" action="view"><ManageSubMenus /></ProtectedRoute> },
    { url: 'manage-subsubmenus', component: <ProtectedRoute requireSuperuser={true} module="settings_subsubmenus" action="view"><ManageSubSubMenus /></ProtectedRoute> },
    { url: 'manage-permissions', component: <ProtectedRoute requireSuperuser={true} module="permissions" action="view"><ManagePermissions /></ProtectedRoute> },
    { url: 'manage-currencies', component: <ProtectedRoute module="currencies" action="view"><ManageCurrency /></ProtectedRoute> },
    { url: 'manage-languages', component: <ProtectedRoute module="languages" action="view"><ManageLanguage /></ProtectedRoute> },
    { url: 'company-settings', component: <ProtectedRoute module="company" action="view"><ManageCompany /></ProtectedRoute> },
    { url: 'branch-details/:id', component: <ProtectedRoute module="company" action="view"><BranchDetails /></ProtectedRoute> },
    { url: 'settings-dashboard', component: <ProtectedRoute module="company" action="view"><CompanySettingsDashboard /></ProtectedRoute> },
    { url: 'settings-report/:entity', component: <ProtectedRoute module="company" action="view"><SettingsReportView /></ProtectedRoute> },
    { url: 'manage-prefix-type', component: <ProtectedRoute module="prefix-type" action="view"><ManagePrefixType /></ProtectedRoute> },
    { url: 'manage-prefix-configuration', component: <ProtectedRoute module="prefix-config" action="view"><ManagePrefixConfiguration /></ProtectedRoute> },
    { url: 'database-backup', component: <ProtectedRoute module="database-backup" action="view"><DatabaseBackup /></ProtectedRoute> },


    /// Access Point
    { url: 'access-point', component: <ProtectedRoute module="access-point" action="view"><AccessPointManagement /></ProtectedRoute> },
    { url: 'access-point/manage/:tab', component: <ProtectedRoute module="access-point" action="view"><AccessPointManagement /></ProtectedRoute> },
    { url: 'access-point/gates', component: <ProtectedRoute module="gates" action="view"><GateForm /></ProtectedRoute> },
    { url: 'access-point/categories', component: <ProtectedRoute module="access-point-categories" action="view"><CategoryForm /></ProtectedRoute> },
    { url: 'access-point/subcategories', component: <ProtectedRoute module="access-point-subcategories" action="view"><SubCategoryForm /></ProtectedRoute> },
    { url: 'access-point/entry-tags', component: <ProtectedRoute module="entry-tags" action="view"><EntryTagForm /></ProtectedRoute> },
    { url: 'access-point/visitors', component: <ProtectedRoute module="visitors" action="view"><VisitorRegistration /></ProtectedRoute> },
    { url: 'access-point/gate-entry', component: <ProtectedRoute module="gate-entry" action="create"><GateEntryForm /></ProtectedRoute> },
    { url: 'access-point/gate-entries', component: <ProtectedRoute module="gate-entry" action="view"><GateEntryList /></ProtectedRoute> },
    { url: 'access-point/master/park-area', component: <ProtectedRoute module="park_area" action="view"><ParkArea /></ProtectedRoute> },
    { url: 'access-point/master/parking-fee', component: <ProtectedRoute module="parking_fee" action="view"><ParkingFee /></ProtectedRoute> },
    { url: 'access-point/entry-card', component: <ProtectedRoute module="entry_card" action="view"><EntryCard /></ProtectedRoute> },
    { url: 'access-point/exit-card', component: <ProtectedRoute module="exit_card" action="view"><ExitCard /></ProtectedRoute> },
    { url: 'access-point/gate-entry/:id', component: <ProtectedRoute module="gate-entry" action="view"><GateEntryDetail /></ProtectedRoute> },
    { url: 'access-point/my-approvals', component: <ProtectedRoute module="gate-entry" action="view"><MyVisitorApprovals /></ProtectedRoute> },
    { url: 'access-point/reallocation', component: <ProtectedRoute module="gate-entry" action="view"><VisitorReallocation /></ProtectedRoute> },
    { url: 'access-point/gate-entry-report', component: <ProtectedRoute module="gate-entry" action="view"><GateEntryReport /></ProtectedRoute> },
    { url: 'access-point/vehicle-types', component: <ProtectedRoute module="gates" action="view"><VehicleTypeManagement /></ProtectedRoute> },
    { url: 'access-point/approveless-configs', component: <ProtectedRoute module="gates" action="view"><ApprovelessEntryConfig /></ProtectedRoute> },
    { url: 'access-point/equipments', component: <ProtectedRoute module="gates" action="view"><EquipmentManagement /></ProtectedRoute> },
    { url: 'access-point/employee-vehicles', component: <ProtectedRoute module="gates" action="view"><EmployeeVehicleConfig /></ProtectedRoute> },

    /// Complaints
    { url: 'complaints', component: <ProtectedRoute module="complaints" action="view"><ComplaintManagement /></ProtectedRoute> },
    { url: 'complaints/list', component: <ProtectedRoute module="complaints" action="view"><ComplaintList /></ProtectedRoute> },
    { url: 'complaints/my', component: <ProtectedRoute module="complaints" action="view"><ComplaintList myOnly={true} /></ProtectedRoute> },
    { url: 'complaints/raise', component: <ProtectedRoute module="complaints" action="create"><ComplaintForm /></ProtectedRoute> },
    { url: 'complaints/detail/:id', component: <ProtectedRoute module="complaints" action="view"><ComplaintDetail /></ProtectedRoute> },
    { url: 'complaints/categories', component: <ProtectedRoute module="complaints" action="view"><CategoryMatrix /></ProtectedRoute> },
    { url: 'complaints/patterns', component: <ProtectedRoute module="complaints" action="view"><CommentPattern /></ProtectedRoute> },
    { url: 'complaints/review', component: <ProtectedRoute module="complaints" action="view"><AdminReviewList /></ProtectedRoute> },
    { url: 'decision-directory', component: <ProtectedRoute module="complaint decision" action="view"><ComplaintFinalDecisionList /></ProtectedRoute> },
    { url: 'complaint-decision/:id', component: <ProtectedRoute module="complaint decision" action="view"><ComplaintFinalDecisionView /></ProtectedRoute> },
    { url: 'complaint-response/:id', component: <ProtectedRoute module="complaint decision" action="view"><ComplaintResponderView /></ProtectedRoute> },

    /// Global Appointments
    { url: 'appointments', component: <ProtectedRoute module="appointments" action="view"><AppointmentList /></ProtectedRoute> },

    /// Task Management
    { url: 'task-management', component: <ProtectedRoute module="task-management" action="view"><TaskManagementDashboard /></ProtectedRoute> },
    { url: 'task-management/dashboard', component: <ProtectedRoute module="task-management" action="view"><TaskManagementDashboard /></ProtectedRoute> },
    { url: 'task-management/report', component: <ProtectedRoute module="task-management" action="view"><TaskReportList /></ProtectedRoute> },
    { url: 'task-management/admin', component: <ProtectedRoute module="task-management" action="view"><TaskAdminDashboard /></ProtectedRoute> },
    { url: 'task-management/admin-report', component: <ProtectedRoute module="task-management" action="view"><TaskAdminReportList /></ProtectedRoute> },
    { url: 'task-management/postponed-report', component: <ProtectedRoute module="task-management" action="view"><TaskPostponedReportList /></ProtectedRoute> },

    { url: 'machine/spareparts', component: <ProtectedRoute module="spareparts" action="view"><SparePartList /></ProtectedRoute> },
    { url: 'machine/lifespans', component: <ProtectedRoute module="spareparts" action="view"><LifespanList /></ProtectedRoute> },
    { url: 'machine/typenames', component: <ProtectedRoute module="spareparts" action="view"><TypeNameList /></ProtectedRoute> },
    { url: 'machine/categories', component: <ProtectedRoute module="spareparts" action="view"><CategoryNameList /></ProtectedRoute> },
    { url: 'machine/subcategories', component: <ProtectedRoute module="spareparts" action="view"><SubCategoryNameList /></ProtectedRoute> },
    { url: 'machine/processes', component: <ProtectedRoute module="spareparts" action="view"><ProcessNameList /></ProtectedRoute> },
    { url: 'machine/machine-voucher', component: <ProtectedRoute module="spareparts" action="view"><MachineVoucherList /></ProtectedRoute> },
    { url: 'machine/repairrequests', component: <ProtectedRoute module="repairrequests" action="view"><RepairRequestList /></ProtectedRoute> },
    { url: 'machine/repairrequests/received', component: <ProtectedRoute module="repairrequests" action="view"><RepairRequestReceiverList /></ProtectedRoute> },
    { url: 'machine/repairrequests/review', component: <ProtectedRoute module="repairrequests" action="view"><RepairRequestReviewList /></ProtectedRoute> },
    { url: 'machine/machineproductmappings', component: <ProtectedRoute module="machineproductmappings" action="view"><MachineProductMappingList /></ProtectedRoute> },
    { url: 'machine/machineoutputs', component: <ProtectedRoute module="machineoutputs" action="view"><MachineOutputList /></ProtectedRoute> },

    /// CRM — dedicated URLs (for sub-submenu support)
    { url: 'crm/dashboard', component: <ProtectedRoute><CrmPage><CrmDashboard /></CrmPage></ProtectedRoute> },
    { url: 'crm/leads', component: <ProtectedRoute><LeadListNew /></ProtectedRoute> },
    { url: 'crm/leads/create', component: <ProtectedRoute><LeadCreateNew /></ProtectedRoute> },
    { url: 'crm/leads/edit/:id', component: <ProtectedRoute><LeadCreateNew /></ProtectedRoute> },
    { url: 'crm/leads/detail/:id', component: <ProtectedRoute><LeadDetailNew /></ProtectedRoute> },
    { url: 'crm/leads/:id', component: <ProtectedRoute><LeadDetailNew /></ProtectedRoute> },
    { url: 'crm_new/leads', component: <ProtectedRoute><LeadListNew /></ProtectedRoute> },
    { url: 'crm_new/leads/create', component: <ProtectedRoute><LeadCreateNew /></ProtectedRoute> },
    { url: 'crm_new/leads/edit/:id', component: <ProtectedRoute><LeadCreateNew /></ProtectedRoute> },
    { url: 'crm_new/leads/detail/:id', component: <ProtectedRoute><LeadDetailNew /></ProtectedRoute> },
    { url: 'crm/telecalling', component: <ProtectedRoute><CrmPage><TeleCallingDashboardNew /></CrmPage></ProtectedRoute> },
    { url: 'crm_new/telecalling', component: <ProtectedRoute><TeleCallingDashboardNew /></ProtectedRoute> },
    { url: 'crm/interactions', component: <ProtectedRoute><CrmPage><TeleCallingInteraction /></CrmPage></ProtectedRoute> },
    { url: 'crm_new/interactions', component: <ProtectedRoute><CrmPage><TeleCallingInteraction /></CrmPage></ProtectedRoute> },
    { url: 'crm/interactions/:id', component: <ProtectedRoute><CrmPage><TeleCallingInteraction /></CrmPage></ProtectedRoute> },
    { url: 'crm_new/interactions/:id', component: <ProtectedRoute><CrmPage><TeleCallingInteraction /></CrmPage></ProtectedRoute> },
    { url: 'crm/caller-leads', component: <ProtectedRoute><CallerMyLeads /></ProtectedRoute> },
    { url: 'crm_new/caller-leads', component: <ProtectedRoute><CallerMyLeads /></ProtectedRoute> },
    { url: 'crm/my-leads', component: <ProtectedRoute><CallerMyLeads /></ProtectedRoute> },
    { url: 'crm_new/my-leads', component: <ProtectedRoute><CallerMyLeads /></ProtectedRoute> },
    { url: 'crm/converted-opportunities', component: <ProtectedRoute><ConvertedOpportunities /></ProtectedRoute> },
    { url: 'crm_new/converted-opportunities', component: <ProtectedRoute><ConvertedOpportunities /></ProtectedRoute> },
    { url: 'crm/opportunity-approvals', component: <ProtectedRoute><OpportunityApprovalList /></ProtectedRoute> },
    { url: 'crm_new/opportunity-approvals', component: <ProtectedRoute><OpportunityApprovalList /></ProtectedRoute> },
    { url: 'crm/categories', component: <ProtectedRoute><LeadCategoryList /></ProtectedRoute> },
    { url: 'crm/lead-categories', component: <ProtectedRoute><LeadCategoryList /></ProtectedRoute> },
    { url: 'crm_new/categories', component: <ProtectedRoute><LeadCategoryList /></ProtectedRoute> },
    { url: 'crm_new/lead-categories', component: <ProtectedRoute><LeadCategoryList /></ProtectedRoute> },
    { url: 'lead-categories', component: <ProtectedRoute><LeadCategoryList /></ProtectedRoute> },
    { url: 'crm/sources', component: <ProtectedRoute><LeadSourceList /></ProtectedRoute> },
    { url: 'crm/lead-sources', component: <ProtectedRoute><LeadSourceList /></ProtectedRoute> },
    { url: 'crm_new/sources', component: <ProtectedRoute><LeadSourceList /></ProtectedRoute> },
    { url: 'crm_new/lead-sources', component: <ProtectedRoute><LeadSourceList /></ProtectedRoute> },
    { url: 'lead-sources', component: <ProtectedRoute><LeadSourceList /></ProtectedRoute> },
    { url: 'crm/services', component: <ProtectedRoute><CrmServiceList /></ProtectedRoute> },
    { url: 'crm/crm-services', component: <ProtectedRoute><CrmServiceList /></ProtectedRoute> },
    { url: 'crm_new/services', component: <ProtectedRoute><CrmServiceList /></ProtectedRoute> },
    { url: 'crm_new/crm-services', component: <ProtectedRoute><CrmServiceList /></ProtectedRoute> },
    { url: 'crm-services', component: <ProtectedRoute><CrmServiceList /></ProtectedRoute> },
    { url: 'crm/industries', component: <ProtectedRoute><IndustryList /></ProtectedRoute> },
    { url: 'crm/lead-industries', component: <ProtectedRoute><IndustryList /></ProtectedRoute> },
    { url: 'crm_new/industries', component: <ProtectedRoute><IndustryList /></ProtectedRoute> },
    { url: 'crm_new/lead-industries', component: <ProtectedRoute><IndustryList /></ProtectedRoute> },
    { url: 'lead-industries', component: <ProtectedRoute><IndustryList /></ProtectedRoute> },
    { url: 'crm/offers', component: <ProtectedRoute><CrmOfferList /></ProtectedRoute> },
    { url: 'crm/crm-offers', component: <ProtectedRoute><CrmOfferList /></ProtectedRoute> },
    { url: 'crm_new/offers', component: <ProtectedRoute><CrmOfferList /></ProtectedRoute> },
    { url: 'crm_new/crm-offers', component: <ProtectedRoute><CrmOfferList /></ProtectedRoute> },
    { url: 'crm-offers', component: <ProtectedRoute><CrmOfferList /></ProtectedRoute> },
    { url: 'crm/performance', component: <ProtectedRoute><CrmReports /></ProtectedRoute> },
    { url: 'crm_new/performance', component: <ProtectedRoute><CrmReports /></ProtectedRoute> },
    { url: 'crm/reports', component: <ProtectedRoute><CrmReports /></ProtectedRoute> },
    { url: 'crm_new/reports', component: <ProtectedRoute><CrmReports /></ProtectedRoute> },
    { url: 'crm/leads-report', component: <ProtectedRoute><CrmLeadsReport /></ProtectedRoute> },
    { url: 'crm_new/leads-report', component: <ProtectedRoute><CrmLeadsReport /></ProtectedRoute> },
    { url: 'crm/converted-leads-report', component: <ProtectedRoute><CrmConvertedLeadsReport /></ProtectedRoute> },
    { url: 'crm_new/converted-leads-report', component: <ProtectedRoute><CrmConvertedLeadsReport /></ProtectedRoute> },
    { url: 'crm/purposes', component: <ProtectedRoute><PurposeList /></ProtectedRoute> },
    { url: 'crm/purpose', component: <ProtectedRoute><PurposeList /></ProtectedRoute> },
    { url: 'crm_new/purposes', component: <ProtectedRoute><PurposeList /></ProtectedRoute> },
    { url: 'purposes', component: <ProtectedRoute><PurposeList /></ProtectedRoute> },
    { url: 'master-purpose', component: <ProtectedRoute><PurposeList /></ProtectedRoute> },
    { url: 'crm/performance', component: <ProtectedRoute><CrmPage><PerformanceDashboard /></CrmPage></ProtectedRoute> },

    /// CRM — backward-compat shell routes (kept so old menu entries still work)
    { url: 'crm', component: <ProtectedRoute><CrmManagement /></ProtectedRoute> },
    { url: 'crm/manage/:tab', component: <ProtectedRoute><CrmManagement /></ProtectedRoute> },
    { url: 'crm/manage/:tab/:id', component: <ProtectedRoute><CrmManagement /></ProtectedRoute> },


    /// Production
    { url: 'production/shifts', component: <ShiftList /> },
    { url: 'production/production-lines', component: <ProductionLineList /> },
    { url: 'production/shift-planning', component: <ShiftPlanManagement /> },
    { url: 'production/shift-planning/create', component: <ShiftPlanForm /> },
    { url: 'production/shift-planning/edit/:id', component: <ShiftPlanForm /> },
    { url: 'production/attendance/:lineId', component: <ProtectedRoute module="production" action="edit"><AttendanceBreakMarkingPage /></ProtectedRoute> },
    { url: 'production/break-types', component: <BreakTypeMasterList /> },
    { url: 'production/employee-attendance-report', component: <ProtectedRoute module="prod_emp_attendance" action="view"><EmployeeAttendanceReport /></ProtectedRoute> },
    { url: 'production/employee_attendance_report', component: <ProtectedRoute module="prod_emp_attendance" action="view"><EmployeeAttendanceReport /></ProtectedRoute> },
    { url: 'production/employee-attendance-report/', component: <ProtectedRoute module="prod_emp_attendance" action="view"><EmployeeAttendanceReport /></ProtectedRoute> },
    { url: 'production/employee_attendance_report/', component: <ProtectedRoute module="prod_emp_attendance" action="view"><EmployeeAttendanceReport /></ProtectedRoute> },
    { url: 'production/post-production-entry', component: <ProtectedRoute module="post_production" action="create"><PostProductionEntryPage /></ProtectedRoute> },
    { url: 'production/assign-responsibility', component: <ProtectedRoute module="entry_assign" action="create"><AssignPostProductionResponsibility /></ProtectedRoute> },
    { url: 'production/adjustments', component: <AdjustmentsPage /> },
    { url: 'production/adjustments/', component: <AdjustmentsPage /> },
    { url: 'adjustments', component: <AdjustmentsPage /> },
    { url: 'production/rnd-entry', component: <RnDEntryPage /> },
    { url: 'rd/rnd-entry', component: <RnDEntryPage /> },
    { url: 'rnd/rnd-entry', component: <RnDEntryPage /> },

    /// logistics

    { url: 'driver-operations', component: <DriverOperationsScreen /> },
    { url: 'my-orders', component: <DriverOrdersScreen /> },
    { url: 'vehicle-category-management', component: <VehicleCategoryManagement /> },
    { url: 'tyre-size-master', component: <TyreSizeList /> },
    { url: 'vehicle-management', component: <VehicleManagement /> },
    { url: 'crm/distribution-zones', component: <ProtectedRoute><DistributionHub><DistributionZoneList /></DistributionHub></ProtectedRoute> },
    { url: 'crm/distributor-leads', component: <ProtectedRoute><DistributionHub><DistributorLead /></DistributionHub></ProtectedRoute> },
    { url: 'crm/leads-list', component: <ProtectedRoute><DistributionHub><PartnerLeadsList /></DistributionHub></ProtectedRoute> },
    { url: 'crm/vendor-leads', component: <ProtectedRoute><DistributionHub><VendorLead /></DistributionHub></ProtectedRoute> },
    /// Finance
    { url: "finance/dashboard", component: <ProtectedRoute module="finance" action="view"><FinanceDashboard /></ProtectedRoute> },
    { url: "finance/account-groups", component: <ProtectedRoute module="accounts_group" action="view"><AccountGroupList /></ProtectedRoute> },
    { url: "finance/ledgers", component: <ProtectedRoute module="ledger" action="view"><LedgerList /></ProtectedRoute> },
    { url: "finance/ledgers/:id", component: <ProtectedRoute module="ledger" action="view"><LedgerDetailsPage /></ProtectedRoute> },
    { url: "finance/ledger-details/:id", component: <ProtectedRoute module="ledger" action="view"><LedgerDetailsPage /></ProtectedRoute> },
    { url: "finance/service-invoices", component: <ProtectedRoute module="finance" action="view"><ServiceInvoice /></ProtectedRoute> },
    { url: "finance/journals", component: <ProtectedRoute module="finance" action="view"><JournalList /></ProtectedRoute> },
    { url: "finance/journals-new", component: <ProtectedRoute module="finance" action="view"><JournalList_new /></ProtectedRoute> },
    { url: "finance/receipts", component: <ProtectedRoute module="finance" action="view"><ReceiptList /></ProtectedRoute> },
    { url: "finance/receipts-new", component: <ProtectedRoute module="finance" action="view"><ReceiptList_new /></ProtectedRoute> },
    { url: "finance/payments", component: <ProtectedRoute module="finance" action="view"><PaymentList /></ProtectedRoute> },
    { url: "finance/payments-new", component: <ProtectedRoute module="finance" action="view"><PaymentList_new /></ProtectedRoute> },
    { url: "finance/contras", component: <ProtectedRoute module="finance" action="view"><ContraList /></ProtectedRoute> },
    { url: "finance/contras-new", component: <ProtectedRoute module="finance" action="view"><ContraList_new /></ProtectedRoute> },
    { url: "finance/stock-journal-types", component: <ProtectedRoute module="finance" action="view"><StockJournalTypeList /></ProtectedRoute> },
    { url: "finance/stock-journals", component: <ProtectedRoute module="finance" action="view"><StockJournalList /></ProtectedRoute> },
    { url: "finance/manufactural-journal-types", component: <ProtectedRoute module="finance" action="view"><ManufacturalJournalTypeList /></ProtectedRoute> },
    { url: "finance/manufactural-journals", component: <ProtectedRoute module="finance" action="view"><ManufacturalJournalList /></ProtectedRoute> },
    { url: "finance/quotations", component: <ProtectedRoute module="finance" action="view"><QuotationManagement /></ProtectedRoute> },
    { url: "finance/voucher-types", component: <ProtectedRoute module="finance" action="view"><VoucherTypeManagement /></ProtectedRoute> },
    { url: "finance/trial-balance", component: <ProtectedRoute module="trial_balance" action="view"><TrialBalance /></ProtectedRoute> },
    { url: "finance/trial-balance/", component: <ProtectedRoute module="trial_balance" action="view"><TrialBalance /></ProtectedRoute> },
    { url: "Finance/Trial-Balance", component: <ProtectedRoute module="trial_balance" action="view"><TrialBalance /></ProtectedRoute> },
    { url: "Finance/Trial-Balance/", component: <ProtectedRoute module="trial_balance" action="view"><TrialBalance /></ProtectedRoute> },

    { url: "finance/profit-loss", component: <ProtectedRoute module="profit_and_loss" action="view"><ProfitAndLoss /></ProtectedRoute> },
    { url: "finance/profit-loss/", component: <ProtectedRoute module="profit_and_loss" action="view"><ProfitAndLoss /></ProtectedRoute> },
    { url: "Finance/profit-loss", component: <ProtectedRoute module="profit_and_loss" action="view"><ProfitAndLoss /></ProtectedRoute> },
    { url: "Finance/profit-loss/", component: <ProtectedRoute module="profit_and_loss" action="view"><ProfitAndLoss /></ProtectedRoute> },

    { url: "finance/balance-sheet", component: <ProtectedRoute module="balance_sheet" action="view"><BalanceSheet /></ProtectedRoute> },
    { url: "finance/balance-sheet/", component: <ProtectedRoute module="balance_sheet" action="view"><BalanceSheet /></ProtectedRoute> },
    { url: "Finance/balance-sheet", component: <ProtectedRoute module="balance_sheet" action="view"><BalanceSheet /></ProtectedRoute> },
    { url: "Finance/balance-sheet/", component: <ProtectedRoute module="balance_sheet" action="view"><BalanceSheet /></ProtectedRoute> },
    { url: "Finance/Balance-Sheet", component: <ProtectedRoute module="balance_sheet" action="view"><BalanceSheet /></ProtectedRoute> },
    { url: "Finance/Balance-Sheet/", component: <ProtectedRoute module="balance_sheet" action="view"><BalanceSheet /></ProtectedRoute> },

    { url: "finance/day-book", component: <ProtectedRoute module="daybook" action="view"><DayBook /></ProtectedRoute> },
    { url: "finance/day-book/", component: <ProtectedRoute module="daybook" action="view"><DayBook /></ProtectedRoute> },
    { url: "Finance/Day-Book", component: <ProtectedRoute module="daybook" action="view"><DayBook /></ProtectedRoute> },
    { url: "Finance/Day-Book/", component: <ProtectedRoute module="daybook" action="view"><DayBook /></ProtectedRoute> },

    { url: "finance/ledger-book", component: <ProtectedRoute module="ledger-book" action="view"><LedgerBook /></ProtectedRoute> },
    { url: "finance/ledger-book/", component: <ProtectedRoute module="ledger-book" action="view"><LedgerBook /></ProtectedRoute> },
    { url: "Finance/Ledger-Book", component: <ProtectedRoute module="ledger-book" action="view"><LedgerBook /></ProtectedRoute> },
    { url: "Finance/Ledger-Book/", component: <ProtectedRoute module="ledger-book" action="view"><LedgerBook /></ProtectedRoute> },

    { url: "inventory/stock-item-book", component: <ProtectedRoute module="stock-item-book" action="view"><StockItemBook /></ProtectedRoute> },
    { url: "inventory/stock-item-book/", component: <ProtectedRoute module="stock-item-book" action="view"><StockItemBook /></ProtectedRoute> },
    { url: "Inventory/Stock-Item-Book", component: <ProtectedRoute module="stock-item-book" action="view"><StockItemBook /></ProtectedRoute> },
    { url: "Inventory/Stock-Item-Book/", component: <ProtectedRoute module="stock-item-book" action="view"><StockItemBook /></ProtectedRoute> },
    { url: "inventory/item-book", component: <ProtectedRoute module="inventory" action="view"><StockItemBook /></ProtectedRoute> },
    { url: "inventory/item-book/", component: <ProtectedRoute module="inventory" action="view"><StockItemBook /></ProtectedRoute> },


    { url: "finance/receivables", component: <ProtectedRoute module="finance" action="view"><ReceivablesReport /></ProtectedRoute> },
    { url: "finance/payables", component: <ProtectedRoute module="finance" action="view"><PayablesReport /></ProtectedRoute> },
    { url: "inventory/price-lists", component: <PriceList /> },
    { url: "inventory/price-lists/", component: <PriceList /> },
    { url: "inventory/price-lists-mapping", component: <PriceListMapping /> },
    { url: "inventory/price-lists-mapping/", component: <PriceListMapping /> },
    { url: "Inventory/price-lists", component: <PriceList /> },
    { url: "Inventory/price-lists/", component: <PriceList /> },
    { url: "Inventory/price-lists-mapping", component: <PriceListMapping /> },
    { url: "Inventory/price-lists-mapping/", component: <PriceListMapping /> },

    { url: 'driver-management', component: <DriverManagement /> },
    { url: 'service-type-management', component: <ServiceTypeManagement /> },
    { url: 'vehicle-history-management', component: <VehicleHistoryManagement /> },
    { url: 'driver-audit-log', component: <DriverAuditLogManagement /> },
    { url: 'vehicle-audit-log', component: <VehicleAuditLogManagement /> },
    { url: 'vehicle-history-audit-log', component: <VehicleHistoryAuditLogManagement /> },
    { url: 'fines-and-tokens', component: <FinesAndTokensScreen /> },
    { url: 'demo-table-configuration', component: <DemoTableConfiguration /> },
    { url: 'machine-data-configuration', component: <MachineDataCollectionConfiguration /> },
    { url: 'machine-config', component: <MachineDataCollectionConfiguration /> },
    { url: 'dynamic-form-configuration', component: <DynamicFormConfiguration /> },
    { url: 'route-master', component: <RouteMasterManagement /> },
    { url: 'route-stops', component: <RouteStopsManagement /> },
    { url: 'route-stop-master-table', component: <RouteStopMasterManagement /> },
    { url: 'common-master/master/area-creation', component: <ProtectedRoute module="area_creation" action="view"><AreaCreation /></ProtectedRoute> },
    { url: 'common-master/master/area-location-mapping', component: <ProtectedRoute module="area_location_mapping" action="view"><AreaLocationMapping /></ProtectedRoute> },
    { url: 'common-master/master/salesman-mapping', component: <ProtectedRoute module="salesman_mapping" action="view"><SalesmanMapping /></ProtectedRoute> },
    { url: 'common-master/master/salesman-visitings', component: <ProtectedRoute module="salesman_visitings" action="view"><SalesmanVisitings /></ProtectedRoute> },
    { url: 'trip-master', component: <TripMasterManagement /> },
    { url: 'package-type-management', component: <PackageTypeManagement /> },
    { url: 'item-specification-management', component: <ItemSpecificationManagement /> },
    { url: 'trip-loading/:id', component: <TripLoadingScreen /> },

    { url: 'sales/invoices', component: <SalesInvoiceManagement /> },
    { url: 'sales/invoices/', component: <SalesInvoiceManagement /> },
    { url: 'Sales/invoices', component: <SalesInvoiceManagement /> },
    { url: 'Sales/invoices/', component: <SalesInvoiceManagement /> },
    { url: 'sales/daily-entries', component: <ProtectedRoute module="sales" action="view"><DailyEntryManagement /></ProtectedRoute> },
    { url: 'sales/daily-entries-report', component: <ProtectedRoute module="sales" action="view"><DailyEntryReport /></ProtectedRoute> },
    { url: 'sales-orders', component: <SalesOrderManagement /> },
    { url: 'sales/tally-sync', component: <TallySalesOrderSync /> },
    { url: 'sales/tally-sync/', component: <TallySalesOrderSync /> },
    { url: 'tally-sync', component: <TallySalesOrderSync /> },
    { url: 'tally-sync/', component: <TallySalesOrderSync /> },
    { url: 'sales/tally-invoice-sync', component: <TallySalesInvoiceSync /> },
    { url: 'sales/tally-invoice-sync/', component: <TallySalesInvoiceSync /> },
    { url: 'tally-invoice-sync', component: <TallySalesInvoiceSync /> },
    { url: 'tally-invoice-sync/', component: <TallySalesInvoiceSync /> },
    { url: 'sales/tally-return-sync', component: <TallySalesReturnSync /> },
    { url: 'sales/tally-return-sync/', component: <TallySalesReturnSync /> },
    { url: 'tally-return-sync', component: <TallySalesReturnSync /> },
    { url: 'tally-return-sync/', component: <TallySalesReturnSync /> },
    { url: 'sales-orders-bulk-update', component: <SalesOrderBulkUpdate /> },
    { url: 'delivery-locations', component: <DeliveryLocationManagement /> },
    { url: 'top-picks-mapping', component: <TopPicksMappingManagement /> },
    { url: 'sales-report-list', component: <ProtectedRoute module="sales" action="view"><SalesReportList /></ProtectedRoute> },

    { url: 'sales-invoice-report-list', component: <ProtectedRoute module="sales" action="view"><SalesInvoiceReportList /></ProtectedRoute> },
    { url: 'customer-sales-invoice-report', component: <ProtectedRoute module="sales" action="view"><CustomerSalesInvoiceReportList /></ProtectedRoute> },
    { url: 'distributor-sales-invoice-report', component: <ProtectedRoute module="sales" action="view"><DistributorSalesInvoiceReportList /></ProtectedRoute> },
    { url: 'customer-sales-return-report', component: <ProtectedRoute module="sales" action="view"><CustomerSalesReturnReportList /></ProtectedRoute> },
    { url: 'sales-return-report', component: <ProtectedRoute module="sales" action="view"><SalesReturnReportList /></ProtectedRoute> },

    { url: 'sales-delivery-report', component: <ProtectedRoute module="sales" action="view"><SalesDeliveryReportList /></ProtectedRoute> },
    { url: 'sales-pending-report', component: <ProtectedRoute module="sales" action="view"><SalesPendingOrdersReportList /></ProtectedRoute> },
    { url: 'driver-sales-report', component: <ProtectedRoute module="sales" action="view"><SalesDriverReportList /></ProtectedRoute> },
    { url: 'vehicle-sales-report', component: <ProtectedRoute module="sales" action="view"><SalesVehicleReportList /></ProtectedRoute> },
    { url: 'customer-sales-report', component: <ProtectedRoute module="sales" action="view"><SalesCustomerReportList /></ProtectedRoute> },
    { url: 'distributor-sales-report', component: <ProtectedRoute module="sales" action="view"><DistributorSalesReportList /></ProtectedRoute> },
    { url: 'sales-returns', component: <SalesReturnManagement /> },

    { url: 'inventory/product-configurations', component: <ProductConfigurationManagement /> },
    { url: 'inventory/physical-stock', component: <PhysicalStockManagement /> },
    { url: 'Inventory/product-configurations', component: <ProductConfigurationManagement /> },
    { url: 'Inventory/physical-stock', component: <PhysicalStockManagement /> },
    { url: 'inventory/warehouse-transfers', component: <WarehouseTransferManagement /> },
    { url: 'inventory/item-movement-report', component: <ItemMovementReportList /> },

    { url: 'sales-returns', component: <SalesReturnManagement /> },
    { url: "finance/ledgers", component: <ProtectedRoute module="finance" action="view"><LedgerList /></ProtectedRoute> },
    { url: 'sales-order-distributor', component: <DistributorSalesOrder /> },
    { url: 'market_connect_master', component: <MarketingConnectDashboard /> },
    { url: 'market_connect_master/login', component: <MarketingConnectLogin /> },
    { url: 'market_connect_master/attendance', component: <AttendanceModule /> },
    { url: 'market-connect/reports/attendance', component: <MarketingAttendanceReport /> },
    { url: 'market-connect/reports/visit-report', component: <MarketingVisitReport /> },
    { url: 'market-connect/reports/follow-up-report', component: <MarketingFollowUpReport /> },
    { url: 'market-connect/reports/executive-visit-report', component: <MarketingExecutiveVisitReport /> },
    { url: 'market_connect_master/attendance/offline', component: <OfflineAttendanceModule /> },
    { url: 'market_connect_master/transport', component: <TransportModule /> },
    { url: 'market_connect_master/leads', component: <LeadsModule /> },
    { url: 'market_connect_master/shop-visit', component: <ShopVisitModule /> },
    { url: 'market_connect_master/orders', component: <OrdersModule /> },
    { url: 'market_connect_master/my-orders', component: <MarketingConnectOrdersList /> },
    { url: 'distributor-orders', component: <DistributorOrdersList /> },
    { url: 'supplier-orders', component: <SupplierOrdersList /> },
    { url: "finance/account-groups", component: <ProtectedRoute module="finance" action="view"><AccountGroupList /></ProtectedRoute> },
    { url: "finance/quotations", component: <QuotationManagement /> },
    { url: "finance/voucher-types", component: <VoucherTypeManagement /> },

    /// Purchase


    { url: 'purchase-orders', component: <PurchaseOrderManagement /> },
    { url: 'purchase-invoices', component: <PurchaseInvoiceManagement /> },
    { url: 'purchase-returns', component: <PurchaseReturnManagement /> },

    /// Company Details
    { url: 'factory-details/:id', component: <FactoryDetails /> },
    { url: 'warehouse-details/:id', component: <WarehouseDetails /> },
    { url: 'mobile-purchase-order', component: <SupplierPurchaseOrder /> },
    { url: 'supplier-purchase-order', component: <SupplierPurchaseOrder /> },
    { url: 'purchase-orders', component: <PurchaseOrderManagement /> },
    { url: 'purchase-order-report', component: <PurchaseOrderReport /> },
    { url: 'purchase-return-report', component: <PurchaseReturnReport /> },
    { url: 'purchase-invoice-report', component: <PurchaseInvoiceReport /> },
    { url: 'supplier-wise-po-report', component: <SupplierWisePOReport /> },
    { url: 'supplier-wise-pi-report', component: <SupplierWisePIReport /> },
    { url: 'supplier-wise-pr-report', component: <SupplierWisePRReport /> },
    { url: 'purchase-invoices', component: <PurchaseInvoiceManagement /> },
    { url: 'purchase-returns', component: <PurchaseReturnManagement /> },
    { url: 'duty-names', component: <DutyNameList /> },
    { url: 'responsibilities', component: <ResponsibilityList /> },
    { url: 'assign-duty', component: <AssignDutyForm /> },
    { url: 'assign-duty-list', component: <AssignDutyList /> },
    { url: 'revoke-duty', component: <RevokeDuty /> },
    { url: 'hr/reports/assign-duty', component: <AssignDutyReport /> },
    { url: 'repair-part', component: <RepairPartForm /> },
    { url: 'repair-part-list', component: <RepairPartList /> },

    /// Dynamic Database Designer
    { url: 'dynamic-db/tables', component: <TableList /> },
    { url: 'dynamic-db/tables/create', component: <CreateTable /> },
    { url: 'dynamic-db/tables/:tableName/edit', component: <EditTable /> },
    { url: 'dynamic-db/:tableName/data', component: <DynamicDataGrid /> },

    /// Inactivity Timeout Settings
    { url: 'inactivity-timeout', component: <InactivityTimeoutSettings /> },
    { url: 'inactivity-timeout/', component: <InactivityTimeoutSettings /> },
    { url: 'Inactivity-timeout', component: <InactivityTimeoutSettings /> },
    { url: 'Inactivity-timeout/', component: <InactivityTimeoutSettings /> },
    { url: 'inactivity-timeout-settings', component: <InactivityTimeoutSettings /> },
    { url: 'inactivity-timeout-settings/', component: <InactivityTimeoutSettings /> },
    { url: 'user-timeout-settings', component: <InactivityTimeoutSettings /> },
    { url: 'user-timeout-settings/', component: <InactivityTimeoutSettings /> },

    { url: 'purchase-invoice-tally-sync', component: <TallyPurchaseInvoiceSync /> },


    // task

    { url: 'task/categories', component: <ProtectedRoute module="task" action="view"><TaskCategoryList /></ProtectedRoute> },
    { url: 'task/sub-categories', component: <ProtectedRoute module="subcategories" action="view"><TaskSubCategoryList /></ProtectedRoute> },
    { url: 'task/tasks', component: <ProtectedRoute module="tasks" action="view"><TaskListPage /></ProtectedRoute> },
    { url: 'task/subtasks', component: <ProtectedRoute module="subtasks" action="view"><SubtaskListPage /></ProtectedRoute> },
    { url: 'task/assign-vote', component: <ProtectedRoute module="tasks" action="view"><AssignTaskVotePage /></ProtectedRoute> },
    { url: 'task/my-votes', component: <ProtectedRoute module="tasks" action="view"><MyPendingVotesPage /></ProtectedRoute> },
    { url: 'task/my-assigned-tasks', component: <ProtectedRoute module="tasks" action="view"><MyAssignedTasksPage /></ProtectedRoute> },
    { url: 'task/assign-task/:taskId', component: <ProtectedRoute module="tasks" action="view"><AssignTaskPage /></ProtectedRoute> },
    { url: 'task/update-progress', component: <ProtectedRoute module="tasks" action="view"><TaskProgressUpdatePage /></ProtectedRoute> },
    { url: 'task/my-report', component: <ProtectedRoute module="tasks" action="view"><MyTaskReportPage /></ProtectedRoute> },
    { url: 'task/my-report/', component: <ProtectedRoute module="tasks" action="view"><MyTaskReportPage /></ProtectedRoute> },
    { url: 'task/not-voted-report', component: <ProtectedRoute module="tasks" action="view"><NotVotedTasksReportPage /></ProtectedRoute> },
    { url: 'task/not-voted-report/', component: <ProtectedRoute module="tasks" action="view"><NotVotedTasksReportPage /></ProtectedRoute> },
    { url: 'task/not-started-report', component: <ProtectedRoute module="tasks" action="view"><NotStartedTasksReportPage /></ProtectedRoute> },
    { url: 'task/not-started-report/', component: <ProtectedRoute module="tasks" action="view"><NotStartedTasksReportPage /></ProtectedRoute> },

    // vote requests from Task, Equipment, Feedback (Complaints) and Appointments
    { url: 'my-votes', component: <ProtectedRoute module="tasks" action="view"><MyVotesPage /></ProtectedRoute> },
    { url: 'my-votes/', component: <ProtectedRoute module="tasks" action="view"><MyVotesPage /></ProtectedRoute> },
    { url: 'purchase-return-tally-sync', component: <TallyPurchaseReturnSync /> },

    // Wallet Module
    { url: 'wallet/master', component: <ProtectedRoute module="wallet_master" action="view"><WalletMaster /></ProtectedRoute> },
    { url: 'wallet/master/', component: <ProtectedRoute module="wallet_master" action="view"><WalletMaster /></ProtectedRoute> },
    { url: 'wallet/master/owner-type', component: <ProtectedRoute module="wallet_ownertype" action="view"><WalletOwnerType /></ProtectedRoute> },
    { url: 'wallet/master/owner-type/', component: <ProtectedRoute module="wallet_ownertype" action="view"><WalletOwnerType /></ProtectedRoute> },
    { url: 'wallet/master/schemes', component: <ProtectedRoute module="wallet_schemes" action="view"><WalletSchemes /></ProtectedRoute> },
    { url: 'wallet/master/schemes/', component: <ProtectedRoute module="wallet_schemes" action="view"><WalletSchemes /></ProtectedRoute> },
    { url: 'wallet/master/reason', component: <ProtectedRoute module="wallet_reason" action="view"><WalletReason /></ProtectedRoute> },
    { url: 'wallet/master/reason/', component: <ProtectedRoute module="wallet_reason" action="view"><WalletReason /></ProtectedRoute> },
    { url: 'wallet/master/working', component: <ProtectedRoute module="wallet_working" action="view"><WalletWorking /></ProtectedRoute> },
    { url: 'wallet/master/working/', component: <ProtectedRoute module="wallet_working" action="view"><WalletWorking /></ProtectedRoute> },
    { url: 'wallet/master/calendar', component: <ProtectedRoute module="wallet_calendar" action="view"><WalletCalendar /></ProtectedRoute> },
    { url: 'wallet/master/calendar/', component: <ProtectedRoute module="wallet_calendar" action="view"><WalletCalendar /></ProtectedRoute> },
    { url: 'wallet/calendar', component: <ProtectedRoute module="wallet_calendar" action="view"><WalletCalendar /></ProtectedRoute> },
    { url: 'wallet/calendar/', component: <ProtectedRoute module="wallet_calendar" action="view"><WalletCalendar /></ProtectedRoute> },
    { url: 'wallet/transactions', component: <ProtectedRoute module="wallet_transactions" action="view"><WalletTransactions /></ProtectedRoute> },
    { url: 'wallet/transactions/', component: <ProtectedRoute module="wallet_transactions" action="view"><WalletTransactions /></ProtectedRoute> },
    { url: 'wallet/transactions/wallet-creation', component: <ProtectedRoute module="wallet_creation" action="view"><WalletCreation /></ProtectedRoute> },
    { url: 'wallet/transactions/wallet-creation/', component: <ProtectedRoute module="wallet_creation" action="view"><WalletCreation /></ProtectedRoute> },
    { url: 'wallet/transactions/points-entry', component: <ProtectedRoute module="wallet_points_entry" action="view"><WalletPointsEntry /></ProtectedRoute> },
    { url: 'wallet/transactions/points-entry/', component: <ProtectedRoute module="wallet_points_entry" action="view"><WalletPointsEntry /></ProtectedRoute> },
    { url: 'wallet/report', component: <ProtectedRoute module="wallet_report" action="view"><WalletReport /></ProtectedRoute> },
    { url: 'wallet/report/', component: <ProtectedRoute module="wallet_report" action="view"><WalletReport /></ProtectedRoute> },

    // DigiLocker Module
    { url: 'digilocker/folder-creation', component: <ProtectedRoute module="digilocker_folder" action="view"><FolderCreation /></ProtectedRoute> },
    { url: 'digilocker/folder-creation/', component: <ProtectedRoute module="digilocker_folder" action="view"><FolderCreation /></ProtectedRoute> },
    { url: 'digilocker/upload-files', component: <ProtectedRoute module="digilocker_upload" action="view"><UploadFiles /></ProtectedRoute> },
    { url: 'digilocker/upload-files/', component: <ProtectedRoute module="digilocker_upload" action="view"><UploadFiles /></ProtectedRoute> },
    { url: 'digilocker/mapping', component: <ProtectedRoute module="digilocker_mapping" action="view"><DigiLockerMapping /></ProtectedRoute> },
    { url: 'digilocker/mapping/', component: <ProtectedRoute module="digilocker_mapping" action="view"><DigiLockerMapping /></ProtectedRoute> },
    { url: 'digilocker/access', component: <ProtectedRoute module="digilocker_access" action="view"><DigiLockerAccess /></ProtectedRoute> },
    { url: 'digilocker/access/', component: <ProtectedRoute module="digilocker_access" action="view"><DigiLockerAccess /></ProtectedRoute> },
    { url: 'digilocker/file-approval', component: <ProtectedRoute module="digilocker_approval" action="view"><FileApproval /></ProtectedRoute> },
    { url: 'digilocker/file-approval/', component: <ProtectedRoute module="digilocker_approval" action="view"><FileApproval /></ProtectedRoute> },
    { url: 'digilocker/report', component: <ProtectedRoute module="digilocker_report" action="view"><DigiLockerReport /></ProtectedRoute> },
    { url: 'digilocker/report/', component: <ProtectedRoute module="digilocker_report" action="view"><DigiLockerReport /></ProtectedRoute> },
    { url: 'digilocker/reports/files-view', component: <ProtectedRoute module="digilocker_files_view_report" action="view"><FilesViewReport /></ProtectedRoute> },
    { url: 'digilocker/reports/files-view/', component: <ProtectedRoute module="digilocker_files_view_report" action="view"><FilesViewReport /></ProtectedRoute> },
    { url: 'digilocker/reports/file-download', component: <ProtectedRoute module="digilocker_file_download_report" action="view"><FileDownloadReport /></ProtectedRoute> },
    { url: 'digilocker/reports/file-download/', component: <ProtectedRoute module="digilocker_file_download_report" action="view"><FileDownloadReport /></ProtectedRoute> },
  );

  return (
    <>
      <Routes>

        <Route path='page-lock-screen' element={<LockScreen />} />
        <Route path='page-error-400' element={<Error400 />} />
        <Route path='page-error-403' element={<Error403 />} />
        <Route path='page-error-404' element={<Error404 />} />
        <Route path='page-error-500' element={<Error500 />} />
        <Route path='page-error-503' element={<Error503 />} />
        <Route element={<MainLayout />} >
          {allroutes.map((data, i) => (
            <Route
              key={data.url || i}
              exact
              path={`${data.url}`}
              element={data.component}
            />
          ))}
          <Route path="*" element={<Error404 />} />
        </Route>
      </Routes>
      <ScrollToTop />
    </>
  )
}

function MainLayout() {
  const sideMenu = useSelector(state => state.sideMenu);
  const { sidebariconHover } = useContext(ThemeContext);
  const location = useLocation();
  const { menus: dynamicMenus } = useSelector(state => state.menu);

  // Globally track page visits whenever location.pathname changes
  useEffect(() => {
    if (!dynamicMenus || dynamicMenus.length === 0) return;
    const cleanPath = location.pathname.replace(/^\/+|\/+$/g, '');

    // Helper to get all leaf items
    const allLeafs = [];
    dynamicMenus.forEach(menu => {
      if (menu.url) {
        allLeafs.push({ id: `menu_${menu.id}`, url: menu.url });
      }
      if (menu.submenus) {
        menu.submenus.forEach(sm => {
          if (sm.url) {
            allLeafs.push({ id: `submenu_${sm.id}`, url: sm.url });
          }
          if (sm.subsubmenus) {
            sm.subsubmenus.forEach(ssm => {
              if (ssm.url) {
                allLeafs.push({ id: `subsubmenu_${ssm.id}`, url: ssm.url });
              }
            });
          }
        });
      }
    });

    const matched = allLeafs.find(leaf => leaf.url.replace(/^\/+|\/+$/g, '').split('?')[0] === cleanPath.split('?')[0]);
    if (matched) {
      try {
        const visitCounts = JSON.parse(localStorage.getItem('quick_access_visit_counts') || '{}');
        visitCounts[matched.id] = (visitCounts[matched.id] || 0) + 1;
        localStorage.setItem('quick_access_visit_counts', JSON.stringify(visitCounts));
        window.dispatchEvent(new Event('quickAccessVisitUpdate'));
      } catch (err) {
        console.error("Error updating page visit counts:", err);
      }
    }
  }, [location.pathname, dynamicMenus]);

  return (
    <TaskReminderProvider>
      <div
        className={`show ${sideMenu ? "menu-toggle" : ""} ${sidebariconHover ? "iconhover-toggle" : ""}`}
        id="main-wrapper"
      >
        <Nav />
        <MeetingNotificationPopup />
        <CrmReminderPopup />
        <RenewalReminderPopup />
        <ApprovalNotificationPopup />
        <InactivityTracker />
        <div className="content-body" style={{ minHeight: window.screen.height - 45 }}>
          <div className="container-fluid">
            <Outlet key={location.pathname} />
          </div>
        </div>
        <Footer />
        {/* AI Chatbot - Floating Widget */}
        <Chatbot />
      </div>
    </TaskReminderProvider>
  )
};
export default Markup
export const MenuList = [
    //Dashboard
    {
        title: 'Dashboard',
        classsChange: 'mm-collapse',
        iconStyle: <i className="flaticon-layout" />,
        content: [
            {
                title: 'Overview',
                hasMenu: true,
                content: [
                    {
                        title: 'Common ERP View',
                        to: 'common-dashboard',
                    }
                ]
            },
            {
                title: 'Dashboard Light',
                to: 'dashboard',
            },
            {
                title: 'Dashboard Dark',
                to: 'dashboard-dark',
            },
            // {
            //     title: 'Project',
            //     to: 'projects',
            // },
            // {
            //     title: 'Contacts',
            //     to: 'contacts',
            // },
            // {
            //     title: 'Task List',
            //     to: 'task-list',

            // },
            // {
            //     title: 'Calendar',
            //     to: 'calendar',                
            // },
            // {
            //     title: 'Messages',
            //     to: 'messages',                
            // },
            // {
            //     title: 'Task',
        ],
    },
    //Assets
    {
        title: 'Assets',
        iconStyle: <i className="flaticon-043-menu" />,
        to: 'file-dashboard',
    },

    //Apps
    {
        title: 'Apps',
        classsChange: 'mm-collapse',
        iconStyle: <i className="flaticon-monitor" />,
        content: [
            // {
            //     title: 'Profile',
            //     to: 'app-profile'
            // },

            // {
            //     title: 'Post Details',
            //     to: 'post-details'
            // },
            {
                title: 'Email',
                //to: './',
                hasMenu: true,
                content: [
                    {
                        title: 'Compose',
                        to: 'email-compose',
                    },
                    {
                        title: 'Index',
                        to: 'email-inbox',
                    },
                    {
                        title: 'Read',
                        to: 'email-read',
                    }
                ],
            },
            {
                title: 'Calendar',
                to: 'app-calender'
            },
            // {
            //     title: 'Shop',
            //     //to: './',
            //     hasMenu : true,
            //     content: [
            //         {
            //             title: 'Product Grid',
            //             to: 'ecom-product-grid',
            //         },
            //         {
            //             title: 'Product List',
            //             to: 'ecom-product-list',
            //         },
            //         {
            //             title: 'Product Details',
            //             to: 'ecom-product-detail',
            //         },
            //         {
            //             title: 'Order',
            //             to: 'ecom-product-order',
            //         },
            //         {
            //             title: 'Checkout',
            //             to: 'ecom-checkout',
            //         },
            //         {
            //             title: 'Invoice',
            //             to: 'ecom-invoice',
            //         },
            //         {
            //             title: 'Customers',
            //             to: 'ecom-customers',
            //         },
            //     ],
            // },
        ],
    },
    //Charts
    // {
    //     title: 'Charts',	
    //     classsChange: 'mm-collapse',
    //     iconStyle:  <i className="flaticon-bar-chart-1" />,
    //     content: [

    //         {
    //             title: 'RechartJs',
    //             to: 'chart-rechart',					
    //         },
    //         {
    //             title: 'Chartjs',
    //             to: 'chart-chartjs',					
    //         },
    //         {
    //             title: 'Sparkline',
    //             to: 'chart-sparkline',					
    //         },
    //         {
    //             title: 'Apexchart',
    //             to: 'chart-apexchart',					
    //         },
    //     ]
    // },
    //Boosttrap
    {
        title: 'Bootstrap',
        classsChange: 'mm-collapse',
        iconStyle: <i className="flaticon-web"></i>,
        content: [
            {
                title: 'Accordion',
                to: 'ui-accordion',
            },
            {
                title: 'Alert',
                to: 'ui-alert',
            },
            {
                title: 'Badge',
                to: 'ui-badge',
            },
            {
                title: 'Button',
                to: 'ui-button',
            },
            {
                title: 'Modal',
                to: 'ui-modal',
            },
            {
                title: 'Button Group',
                to: 'ui-button-group',
            },
            {
                title: 'List Group',
                to: 'ui-list-group',
            },
            {
                title: 'Cards',
                to: 'ui-card',
            },
            {
                title: 'Carousel',
                to: 'ui-carousel',
            },
            {
                title: 'Dropdown',
                to: 'ui-dropdown',
            },
            {
                title: 'Popover',
                to: 'ui-popover',
            },
            {
                title: 'Progressbar',
                to: 'ui-progressbar',
            },
            {
                title: 'Tab',
                to: 'ui-tab',
            },
            {
                title: 'Typography',
                to: 'ui-typography',
            },
            {
                title: 'Pagination',
                to: 'ui-pagination',
            },
            {
                title: 'Grid',
                to: 'ui-grid',
            },
        ]
    },
    //plugins
    // {
    //     title:'Plugins',
    //     classsChange: 'mm-collapse',
    //     iconStyle : <i className="flaticon-plugin"></i>,
    //     content : [
    //         {
    //             title:'Select 2',
    //             to: 'uc-select2',
    //         },

    //         {
    //             title:'Sweet Alert',
    //             to: 'uc-sweetalert',
    //         },
    //         {
    //             title:'Toastr',
    //             to: 'uc-toastr',
    //         },
    //         {
    //             title:'Jqv Map',
    //             to: 'map-jqvmap',
    //         },
    //         {
    //             title:'Light Gallery',
    //             to: 'uc-lightgallery',
    //         },
    //     ]
    // },
    // {
    //     title:'Redux',
    //     classsChange: 'mm-collapse',
    //     iconStyle: <i className="flaticon-068-plus"></i>,
    //     content : [
    //         {
    //             title:'Todo',
    //             to: 'todo',
    //         },
    //     ]
    // },
    //Widget
    // {   
    //     title:'Widget',
    //     //classsChange: 'mm-collapse',
    //     iconStyle: <i className="flaticon-admin"></i>,
    //     to: 'widget-basic',
    // },
    // //Forms
    // {
    //     title:'Forms',
    //     classsChange: 'mm-collapse',
    //     iconStyle: <i className="flaticon-072-printer"></i>,
    //     content : [
    //         {
    //             title:'Form Elements',
    //             to: 'form-element',
    //         },
    //         {
    //             title:'Wizard',
    //             to: 'form-wizard',
    //         },
    //         {
    //             title:'CkEditor',
    //             to: 'form-editor',
    //         },
    //         {
    //             title:'Pickers',
    //             to: 'form-pickers',
    //         },
    //         {
    //             title:'Form Validate',
    //             to: 'form-validation',
    //         },

    //     ]
    // },
    //Table
    // {
    //     title:'Table',
    //     classsChange: 'mm-collapse',
    //     iconStyle: <i className="flaticon-table"></i>,
    //     content : [
    //         {
    //             title:'Table Filtering',
    //             to: 'table-filtering',
    //         },
    //         {
    //             title:'Table Sorting',
    //             to: 'table-sorting',
    //         },
    //         {
    //             title:'Bootstrap',
    //             to: 'table-bootstrap-basic',
    //         },



    //     ]
    // },
    //Pages
    // {
    //     title:'Pages',
    //     classsChange: 'mm-collapse',
    //     iconStyle: <i className="flaticon-newsletter"></i>,
    //     content : [
    //         {
    //             title:'Error',
    //             hasMenu : true,
    //             content : [
    //                 {
    //                     title: 'Error 400',
    //                     to : 'page-error-400',
    //                 },
    //                 {
    //                     title: 'Error 403',
    //                     to : 'page-error-403',
    //                 },
    //                 {
    //                     title: 'Error 404',
    //                     to : 'page-error-404',
    //                 },
    //                 {
    //                     title: 'Error 500',
    //                     to : 'page-error-500',
    //                 },
    //                 {
    //                     title: 'Error 503',
    //                     to : 'page-error-503',
    //                 },
    //             ],
    //         },
    //         {
    //             title:'Lock Screen',
    //             to: 'page-lock-screen',
    //         },

    //     ]
    // },

    //Meeting Management
    {
        title: 'Meeting Management',
        classsChange: 'mm-collapse',
        iconStyle: <i className="flaticon-381-networking" />,
        content: [
            {
                title: 'Categories',
                to: 'meeting/categories',
            },
            {
                title: 'Meeting Rooms',
                to: 'meeting/rooms',
            },
            {
                title: 'My Meetings',
                to: 'meeting/list',
            },
            {
                title: 'Assigned Meetings',
                to: 'meeting/assigned',
            },
            {
                title: 'Meeting Approvals',
                to: 'meeting/approver-list',
            },
            {
                title: 'My Tasks',
                to: 'meeting/my-tasks',
            },
            {
                title: 'Reports',
                hasMenu: true,
                content: [
                    { title: 'All Meetings', to: 'meeting/reports/all' },
                    { title: 'Pending Meetings', to: 'meeting/reports/pending' },
                    { title: 'Approved Meetings', to: 'meeting/reports/approved' },
                    { title: 'Completed Meetings', to: 'meeting/reports/completed' },
                    { title: 'Upcoming Meetings', to: 'meeting/reports/upcoming' },
                ]
            },
        ]
    },
    //Master
    {
        title: 'Master',
        classsChange: 'mm-collapse',
        iconStyle: <i className="flaticon-381-layer-1" />,
        content: [
            {
                title: 'Marketing Connect',
                to: 'marketing-connect',
            },
        ]
    },
    //HR Masters
    {
        title: 'HR Masters',
        classsChange: 'mm-collapse',
        iconStyle: <i className="flaticon-381-user-9" />,
        content: [
            {
                title: 'Departments',
                to: 'hr/departments',
            },
            {
                title: 'Designations',
                to: 'hr/designations',
            },
            {
                title: 'Department Assignments',
                to: 'hr/department-designations',
            },
            {
                title: 'Roles',
                to: 'hr/roles',
            },
            {
                title: 'Leave Types',
                to: 'attendance/leave-types',
            },
            {
                title: 'Leave Requests',
                to: 'attendance/leave-requests',
            },
            {
                title: 'Duty Names',
                to: 'duty-names',
            },
            {
                title: 'Responsibilities',
                to: 'responsibilities',
            },
            {
                title: 'Assign Duties',
                to: 'assign-duty-list',
            },
            {
                title: 'Revoke Duties',
                to: 'revoke-duty',
            },
        ]
    },
    //Payroll
    {
        title: 'Payroll',
        classsChange: 'mm-collapse',
        iconStyle: <i className="fa fa-money-bill-wave" />,
        content: [
            {
                title: 'Pay Units',
                to: 'payroll/units',
            },
            {
                title: 'Compound Pay Units',
                to: 'payroll/compound-units',
            },
            {
                title: 'Attendance & Output Types',
                to: 'payroll/attendance-production-types',
            },
            {
                title: 'Calculation Methods',
                to: 'payroll/calculation-types',
            },
            {
                title: 'Pay Components',
                to: 'payroll/pay-heads',
            },
        ]
    },
    //Inventory

    {
        title: 'Inventory',
        classsChange: 'mm-collapse',
        iconStyle: <i className="flaticon-381-box" />,
        content: [
            {
                title: 'Units',
                to: 'inventory/units',
            },
            {
                title: 'Stock Groups',
                to: 'inventory/stock-groups',
            },
            {
                title: 'Stock Categories',
                to: 'inventory/stock-categories',
            },
            {
                title: 'Stock Items',
                to: 'inventory/stock-items',
            },
            {
                title: 'Recipes (BOM)',
                to: 'inventory/recipes',
            },
            {
                title: 'Physical Stock',
                to: 'inventory/physical-stock',
            },
            {
                title: 'Warehouse Transfer',
                to: 'inventory/warehouse-transfers',
            },
        ]
    },
    //Renewal Reminders
    {
        title: 'Renewal Reminders',
        classsChange: 'mm-collapse',
        iconStyle: <i className="flaticon-381-calendar-1" />,
        content: [
            {
                title: 'Renewal Reminders',
                to: 'renewal/reminders',
            },
            {
                title: 'Renewal Subjects',
                to: 'renewal/subjects',
            },
            {
                title: 'Renewal Updation',
                to: 'renewal/updation',
            },
            {
                title: 'Renewal Report',
                to: 'renewal/report',
            },
            {
                title: 'Renewal History Report',
                to: 'renewal/history-report',
            },
        ]
    },
    //CRM
    {
        title: 'CRM',
        iconStyle: <i className="flaticon-381-networking" />,
        to: 'crm',
    },
    //Access Point
    {
        title: 'Access Point',
        iconStyle: <i className="flaticon-layout" />,
        to: 'access-point',
    },
    //Appointments
    {
        title: 'Appointments',
        iconStyle: <i className="flaticon-381-calendar-1" />,
        to: 'appointments',
    },
    //Complaints
    {
        title: 'Complaints',
        classsChange: 'mm-collapse',
        iconStyle: <i className="flaticon-381-notepad" />,
        content: [
            {
                title: 'Complaint Directory',
                to: 'complaints',
            },
            {
                title: 'Post Comment',
                to: 'complaints/review',
            },
        ]
    },
    //Finance
    {
        title: 'Finance',
        classsChange: 'mm-collapse',
        iconStyle: <i className="flaticon-381-controls-3" />,
        content: [
            {
                title: 'Account Groups',
                to: 'finance/account-groups',
            },
            {
                title: 'Ledgers',
                to: 'finance/ledgers',
            },
            {
                title: 'Voucher Types',
                to: 'finance/voucher-types',
            },
        ]
    },
    //Machine Management
    {
        title: 'Machine Management',
        classsChange: 'mm-collapse',
        iconStyle: <i className="flaticon-381-settings-2" />,
        content: [
            {
                title: 'Spare Parts',
                to: 'machine/spareparts',
            },
            {
                title: 'Lifespans',
                to: 'machine/lifespans',
            },
            {
                title: 'Type Names',
                to: 'machine/typenames',
            },
            {
                title: 'Categories',
                to: 'machine/categories',
            },
            {
                title: 'Sub-Categories',
                to: 'machine/subcategories',
            },
            {
                title: 'Processes',
                to: 'machine/processes',
            },
            {
                title: 'Machine Vouchers',
                to: 'machine/machine-voucher',
            },
            {
                title: 'Repair Requests',
                to: 'machine/repairrequests',
            },
            {
                title: 'Repair Request Receiver',
                to: 'machine/repairrequests/received',
            },
            {
                title: 'Review Feedback List',
                to: 'machine/repairrequests/review',
            },
            {
                title: 'Machine Mappings',
                to: 'machine/machineproductmappings',
            },
            {
                title: 'Machine Outputs',
                to: 'machine/machineoutputs',
            },
        ]
    },
    // R & D
    {
        title: 'R & D',
        classsChange: 'mm-collapse',
        iconStyle: <i className="flaticon-381-layer-1" />,
        content: [
            {
                title: 'R&D Entry',
                to: 'rd/rnd-entry',
            },
            {
                title: 'Adjustments',
                to: 'production/adjustments',
            },
        ]
    },
]


import { format, parseISO, isValid } from 'date-fns';

/**
 * Gets the company's preferred date format from localStorage.
 * Defaults to 'DD/MM/YYYY'.
 */
export const getCompanyDateFormat = () => {
    try {
        const companySettings = JSON.parse(localStorage.getItem('companySettings') || '{}');
        return companySettings.dateFormat || companySettings.date_format || 'DD/MM/YYYY';
    } catch {
        return 'DD/MM/YYYY';
    }
};

/**
 * Returns the date-fns / react-datepicker format string matching company settings.
 * e.g. 'dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd', 'dd-MM-yyyy', 'dd MMM yyyy'
 */
export const getDatePickerFormat = () => {
    const displayFormat = getCompanyDateFormat();
    const formatMapping = {
        'DD/MM/YYYY': 'dd/MM/yyyy',
        'MM/DD/YYYY': 'MM/dd/yyyy',
        'YYYY-MM-DD': 'yyyy-MM-dd',
        'DD-MM-YYYY': 'dd-MM-yyyy',
        'DD MMM YYYY': 'dd MMM yyyy'
    };
    return formatMapping[displayFormat] || 'dd/MM/yyyy';
};

/**
 * Formats a date value based on the company's preferred date format setting.
 * @param {string | Date | number} dateValue - The date to format
 * @param {object} [options] - Optional settings { includeTime: boolean, fallback: string }
 * @returns {string} - Formatted date string
 */
export const formatDate = (dateValue, options = {}) => {
    const fallback = options.fallback !== undefined ? options.fallback : '-';
    if (!dateValue) return fallback;

    const displayFormat = getCompanyDateFormat();

    // Map user-friendly choice to date-fns format pattern
    const formatMapping = {
        'DD/MM/YYYY': 'dd/MM/yyyy',
        'MM/DD/YYYY': 'MM/dd/yyyy',
        'YYYY-MM-DD': 'yyyy-MM-dd',
        'DD-MM-YYYY': 'dd-MM-yyyy',
        'DD MMM YYYY': 'dd MMM yyyy'
    };

    let targetFormat = formatMapping[displayFormat] || 'dd/MM/yyyy';
    if (options.includeTime) {
        targetFormat += ' hh:mm a';
    }

    try {
        let date;
        if (dateValue instanceof Date) {
            date = dateValue;
        } else if (typeof dateValue === 'string') {
            const cleanStr = dateValue.trim();
            if (!cleanStr) return fallback;
            date = parseISO(cleanStr);
            if (!isValid(date)) {
                date = new Date(cleanStr);
            }
        } else if (typeof dateValue === 'number') {
            date = new Date(dateValue);
        }

        if (!date || !isValid(date)) {
            return String(dateValue);
        }

        return format(date, targetFormat);
    } catch (error) {
        console.error('Date formatting error:', error);
        return String(dateValue);
    }
};

/**
 * Formats a date value with time appended (e.g. 28/07/2026 09:20 AM)
 * @param {string | Date | number} dateValue - The date to format
 * @returns {string} - Formatted date and time string
 */
export const formatDateTime = (dateValue) => {
    return formatDate(dateValue, { includeTime: true });
};

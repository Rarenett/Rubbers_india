import Swal from 'sweetalert2';

/**
 * Clean up text into a neat, human-readable field label.
 * @param {string} text 
 * @returns {string}
 */
const cleanLabelText = (text) => {
    if (!text) return '';
    return text
        .replace(/[\*\:\#]/g, '') // remove asterisks, colons, hashes
        .replace(/^\s*(enter|select|choose|please enter|please select)\s+/i, '') // remove leading verbs
        .replace(/\s+/g, ' ')
        .trim();
};

/**
 * Format camelCase or snake_case string into Title Case.
 * @param {string} str 
 * @returns {string}
 */
const toTitleCase = (str) => {
    if (!str) return '';
    return str
        .replace(/[-_]/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, c => c.toUpperCase())
        .trim();
};

/**
 * Resolves a human-readable name for any given form element.
 * @param {HTMLElement} element 
 * @returns {string}
 */
export const getHumanReadableFieldName = (element) => {
    if (!element) return 'Required Field';

    // 1. Check for linked label via id (e.g. <label for="id">)
    if (element.id) {
        try {
            const label = document.querySelector(`label[for="${element.id}"]`);
            if (label && label.textContent.trim()) {
                const cleaned = cleanLabelText(label.textContent);
                if (cleaned) return cleaned;
            }
        } catch (e) {}
    }

    // 2. Check for parent label or nearby .form-label / label inside closest form-group / container
    const container = element.closest('.form-group, .mb-3, .mb-2, .mb-4, .col, .col-md-6, .col-md-4, .col-md-12, .col-sm-6, .col-12, div');
    if (container) {
        const label = container.querySelector('.form-label, .form-label-custom, label, .control-label, h6');
        if (label && label.textContent.trim()) {
            const cleaned = cleanLabelText(label.textContent);
            if (cleaned) return cleaned;
        }
    }

    // 3. Check aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) {
        const cleaned = cleanLabelText(ariaLabel);
        if (cleaned) return cleaned;
    }

    // 4. Check placeholder
    const placeholder = element.getAttribute('placeholder');
    if (placeholder && placeholder.trim()) {
        const cleaned = cleanLabelText(placeholder);
        if (cleaned) return cleaned;
    }

    // 5. Fallback to name or id attribute converted to Title Case
    const nameOrId = element.name || element.id;
    if (nameOrId) {
        return toTitleCase(nameOrId);
    }

    return 'Required Field';
};

/**
 * Display a standardized SweetAlert2 warning popup listing missing required fields.
 * @param {string[]|string} missingFields - List of field names or single message
 * @param {Object} options - Optional customizations (e.g. title, message, swalOptions)
 * @returns {boolean} true if warning was shown, false otherwise
 */
export const showRequiredFieldsWarning = (missingFields, options = {}) => {
    const list = Array.isArray(missingFields)
        ? missingFields.filter(Boolean)
        : typeof missingFields === 'string'
        ? [missingFields]
        : [];

    if (list.length === 0) return false;

    const title = options.title || 'Required Fields Missing';
    const message = options.message || `Please fill in the following required field${list.length > 1 ? 's' : ''} to successfully save the form:`;

    Swal.fire({
        icon: 'warning',
        title: title,
        html: `
            <div style="text-align: left; padding: 0 10px;">
                <p style="margin-bottom: 8px; font-size: 14px; color: #475569;">${message}</p>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #d97706; font-weight: 600; line-height: 1.6;">
                    ${list.map(field => `<li style="margin-bottom: 4px;">${field}</li>`).join('')}
                </ul>
            </div>
        `,
        confirmButtonText: 'OK',
        confirmButtonColor: '#0a500f',
        ...options.swalOptions,
    });

    return true;
};

/**
 * Sets up global interception for form validation 'invalid' events.
 * Prevents native browser tooltip popups and shows a unified SweetAlert2 warning popup.
 * @returns {Function} Cleanup function to remove event listener
 */
export const setupGlobalFormValidation = () => {
    const handleInvalid = (e) => {
        // Prevent default browser validation popup
        e.preventDefault();

        const target = e.target;
        if (!target) return;

        const form = target.closest('form');
        if (!form) {
            const fieldName = getHumanReadableFieldName(target);
            showRequiredFieldsWarning([fieldName]);
            return;
        }

        // Throttle per form so multiple invalid fields in a single submission trigger one popup
        if (form._globalValidationHandled) return;
        form._globalValidationHandled = true;
        setTimeout(() => {
            delete form._globalValidationHandled;
        }, 600);

        // Collect all invalid elements inside this form
        const invalidElements = Array.from(form.querySelectorAll(':invalid'));
        if (invalidElements.length === 0) return;

        const missingFieldNames = [];
        const seenNames = new Set();

        invalidElements.forEach((el) => {
            const name = getHumanReadableFieldName(el);
            if (name && !seenNames.has(name.toLowerCase())) {
                seenNames.add(name.toLowerCase());
                missingFieldNames.push(name);
            }
        });

        if (missingFieldNames.length > 0) {
            showRequiredFieldsWarning(missingFieldNames);

            // Focus the first invalid element after a short delay
            setTimeout(() => {
                try {
                    invalidElements[0]?.focus();
                } catch (err) {}
            }, 100);
        }
    };

    // Use capturing phase so we intercept before any other handlers
    document.addEventListener('invalid', handleInvalid, true);

    return () => {
        document.removeEventListener('invalid', handleInvalid, true);
    };
};

export default {
    showRequiredFieldsWarning,
    getHumanReadableFieldName,
    setupGlobalFormValidation,
};

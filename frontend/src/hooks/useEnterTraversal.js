import { useRef } from 'react';

export const useEnterTraversal = (containerSelector = '.sgfm-modal', stateUpdater = null) => {
    const currentSelectControlRef = useRef(null);

    const getFocusable = () => {
        const active = document.activeElement;
        const modal = (active && active.closest('.modal-content')) || document.querySelector(containerSelector);
        if (!modal) return [];
        return Array.from(
            modal.querySelectorAll(
                '.form-control, .form-select, .sof-input, .sof-table-input, .sof-modal-ctrl, .sof-cell-input, .sof-cell-select, .form-control-custom, input[type="checkbox"]:not([disabled]), input[type="radio"]:not([disabled]), .react-select__control, .image-upload-btn, .quick-add-btn, button[type="submit"]:not([disabled])'
            )
        ).filter(el => el.offsetParent !== null && !el.disabled);
    };

    const focusNextFromControl = (control) => {
        const all = getFocusable();
        const index = all.indexOf(control);
        if (index > -1 && index < all.length - 1) {
            if (index === all.length - 2) {
                all[all.length - 1].click();
            } else {
                const next = all[index + 1];
                if (next.classList.contains('react-select__control')) {
                    next.querySelector('input')?.focus();
                } else {
                    next.focus();
                }
            }
        }
    };

    const handleFormKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        if (e.target.tagName.toLowerCase() === 'textarea') return;
        if (e.target.tagName.toLowerCase() === 'button' && e.target.type !== 'submit') return;

        const all = getFocusable();
        const index = all.indexOf(document.activeElement);
        if (index > -1 && index < all.length - 1) {
            e.preventDefault();
            const next = all[index + 1];
            if (index === all.length - 2) {
                all[all.length - 1].click();
            } else if (next.classList.contains('react-select__control')) {
                next.querySelector('input')?.focus();
            } else {
                next.focus();
            }
        }
    };

    const handleSelectFocus = (e) => {
        currentSelectControlRef.current = e.target.closest('.react-select__control');
    };

    const handleSelectKeyDown = (e) => {
        if (e.key === 'Enter') {
            const menuOpen = !!document.querySelector('.react-select__menu');
            if (!menuOpen) {
                e.preventDefault();
                e.stopPropagation();
                const control = e.target.closest('.react-select__control');
                if (control) focusNextFromControl(control);
            }
        }
    };

    const makeSelectChange = (field) => (opt) => {
        if (stateUpdater) {
            stateUpdater(prev => ({ ...prev, [field]: opt ? opt.value : '' }));
        }
        if (opt !== null) {
            const control = currentSelectControlRef.current;
            if (control) setTimeout(() => focusNextFromControl(control), 10);
        }
    };

    return {
        handleFormKeyDown,
        handleSelectFocus,
        handleSelectKeyDown,
        makeSelectChange
    };
};

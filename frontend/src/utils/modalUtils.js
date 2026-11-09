import { useEffect } from 'react';

/**
 * Global utility to close modals when the Escape key is pressed.
 */

/**
 * Closes the topmost active modal in the DOM.
 * Returns true if a modal was found and closed, false otherwise.
 * @returns {boolean}
 */
export const closeTopModal = () => {
    // 1. If SweetAlert popup is active, SweetAlert manages its own dismiss
    if (document.querySelector('.swal2-container.swal2-shown')) {
        return false;
    }

    // 2. If an open select dropdown, popover or datepicker exists, let that close first
    const openDropdown = document.querySelector(
        '.react-select__menu, .react-select__menu-list, .dropdown-menu.show, .flatpickr-calendar.open, .react-datepicker-popper'
    );
    if (openDropdown) {
        return false;
    }

    // 3. Find all visible open modals or dialogs
    const modalCandidates = Array.from(
        document.querySelectorAll(
            '.modal.show, .modal[style*="display: block"], [role="dialog"][aria-modal="true"], .offcanvas.show, .custom-modal.show'
        )
    ).filter((el) => {
        try {
            const style = window.getComputedStyle(el);
            return (
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                style.opacity !== '0' &&
                el.offsetWidth > 0 &&
                el.offsetHeight > 0
            );
        } catch {
            return false;
        }
    });

    if (modalCandidates.length === 0) {
        return false;
    }

    // 4. Sort candidates so the topmost (highest z-index, or latest in DOM) is chosen
    modalCandidates.sort((a, b) => {
        const zA = parseInt(window.getComputedStyle(a).zIndex, 10) || 0;
        const zB = parseInt(window.getComputedStyle(b).zIndex, 10) || 0;
        return zA - zB;
    });

    const topModal = modalCandidates[modalCandidates.length - 1];

    // 5. Look for the modal's close button
    const closeSelector = [
        '.modal-close-x',
        '.btn-close',
        '.btn-close-custom',
        '.modal-close-bm',
        '.sof-modal-close',
        '[data-bs-dismiss="modal"]',
        '[data-dismiss="modal"]',
        'button.close',
        '[aria-label="Close"]',
        '[aria-label="close"]'
    ].join(', ');

    let closeButton = topModal.querySelector(closeSelector);

    // Fallback: look for a cancel/close button in footer or among modal buttons
    if (!closeButton) {
        const buttons = Array.from(topModal.querySelectorAll('.modal-footer button, button'));
        closeButton = buttons.find((btn) => {
            const text = (btn.textContent || '').trim().toLowerCase();
            return text === 'cancel' || text === 'close' || text === 'discard' || text === 'dismiss';
        });
    }

    if (closeButton && typeof closeButton.click === 'function') {
        closeButton.click();
        return true;
    }

    return false;
};

/**
 * Initializes a global keyboard listener that triggers closeTopModal when Escape is pressed.
 * Can be invoked once at the application root (e.g. in App.jsx).
 * @returns {Function} Cleanup function to remove the listener
 */
export const setupGlobalModalEsc = () => {
    const handleGlobalKeyDown = (e) => {
        if (e.key === 'Escape' || e.keyCode === 27) {
            const closed = closeTopModal();
            if (closed) {
                e.preventDefault();
                e.stopPropagation();
            }
        }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);

    // Expose globally on window for debugging or manual invocation
    if (typeof window !== 'undefined') {
        window.closeTopModal = closeTopModal;
    }

    return () => {
        window.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
};

/**
 * React hook to close a modal on Escape key press for component-specific usage.
 * @param {boolean} isOpen
 * @param {Function} onClose
 */
export const useModalEsc = (isOpen, onClose) => {
    useEffect(() => {
        if (!isOpen || typeof onClose !== 'function') return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape' || e.keyCode === 27) {
                // If a select menu is open, let it close first
                if (document.querySelector('.react-select__menu, .react-select__menu-list, .dropdown-menu.show')) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [isOpen, onClose]);
};

export default setupGlobalModalEsc;

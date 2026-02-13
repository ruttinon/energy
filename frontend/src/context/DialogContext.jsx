import React, { createContext, useContext, useState, useCallback } from 'react';
import PremiumConfirmDialog from '../components/UI/PremiumConfirmDialog';

const DialogContext = createContext();

export const useDialog = () => useContext(DialogContext);

export const DialogProvider = ({ children }) => {
    const [dialogState, setDialogState] = useState({
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        onConfirm: null,
        onCancel: null,
        type: 'confirm', // confirm, alert, prompt
        inputValue: '',
        inputPlaceholder: ''
    });

    const closeDialog = useCallback(() => {
        setDialogState(prev => ({ ...prev, isOpen: false }));
    }, []);

    const showConfirm = useCallback((title, message, options = {}) => {
        return new Promise((resolve) => {
            setDialogState({
                isOpen: true,
                title,
                message,
                confirmText: options.confirmText || 'ยืนยัน',
                cancelText: options.cancelText || 'ยกเลิก',
                type: 'confirm',
                onConfirm: () => {
                    closeDialog();
                    resolve(true);
                },
                onCancel: () => {
                    closeDialog();
                    resolve(false);
                }
            });
        });
    }, [closeDialog]);

    const showAlert = useCallback((title, message, options = {}) => {
        return new Promise((resolve) => {
             setDialogState({
                isOpen: true,
                title,
                message,
                confirmText: options.confirmText || 'ตกลง',
                cancelText: null,
                type: 'alert',
                onConfirm: () => {
                    closeDialog();
                    resolve(true);
                },
                onCancel: () => {
                     closeDialog();
                     resolve(true);
                }
            });
        });
    }, [closeDialog]);

    const showPrompt = useCallback((title, message, defaultValue = '', options = {}) => {
        return new Promise((resolve) => {
            setDialogState({
                isOpen: true,
                title,
                message,
                confirmText: options.confirmText || 'ตกลง',
                cancelText: options.cancelText || 'ยกเลิก',
                type: 'prompt',
                inputValue: defaultValue,
                inputPlaceholder: options.placeholder || '',
                onConfirm: (val) => {
                    closeDialog();
                    resolve(val);
                },
                onCancel: () => {
                    closeDialog();
                    resolve(null);
                }
            });
        });
    }, [closeDialog]);

    return (
        <DialogContext.Provider value={{ showConfirm, showAlert, showPrompt }}>
            {children}
            <PremiumConfirmDialog
                isOpen={dialogState.isOpen}
                title={dialogState.title}
                message={dialogState.message}
                confirmText={dialogState.confirmText}
                cancelText={dialogState.cancelText}
                onConfirm={dialogState.onConfirm}
                onCancel={dialogState.onCancel}
                type={dialogState.type}
                inputValue={dialogState.inputValue}
                inputPlaceholder={dialogState.inputPlaceholder}
                onInputChange={(val) => {
                    setDialogState(prev => ({ ...prev, inputValue: val }));
                }}
            />
        </DialogContext.Provider>
    );
};

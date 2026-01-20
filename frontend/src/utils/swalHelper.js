// SweetAlert2 Helper Utility
// Provides consistent styling and common alert patterns

import Swal from 'sweetalert2'

// Default configuration matching app theme
const defaultConfig = {
  confirmButtonColor: '#e9931c',
  cancelButtonColor: '#6c757d',
  width: '500px',
  customClass: {
    popup: 'rounded-lg',
    confirmButton: 'px-5 py-2 rounded-lg font-medium',
    cancelButton: 'px-5 py-2 rounded-lg font-medium'
  }
}

// Success alert
export const showSuccess = (title, text = '', html = '') => {
  return Swal.fire({
    ...defaultConfig,
    icon: 'success',
    title,
    text: html ? '' : text,
    html: html || text
  })
}

// Error alert
export const showError = (title, text = '') => {
  return Swal.fire({
    ...defaultConfig,
    icon: 'error',
    title,
    text
  })
}

// Warning alert
export const showWarning = (title, text = '') => {
  return Swal.fire({
    ...defaultConfig,
    icon: 'warning',
    title,
    text
  })
}

// Info alert
export const showInfo = (title, text = '') => {
  return Swal.fire({
    ...defaultConfig,
    icon: 'info',
    title,
    text
  })
}

// Confirmation dialog
export const showConfirm = (title, text = '', confirmText = 'Yes', cancelText = 'Cancel') => {
  return Swal.fire({
    ...defaultConfig,
    title,
    text,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText
  })
}

// Delete confirmation (red button)
export const showDeleteConfirm = (title, text = 'This action cannot be undone.') => {
  return Swal.fire({
    ...defaultConfig,
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#dc3545',
    confirmButtonText: 'Yes, Delete',
    cancelButtonText: 'Cancel'
  })
}

// Input prompt
export const showInput = (title, text = '', placeholder = '', inputType = 'text') => {
  return Swal.fire({
    ...defaultConfig,
    title,
    text,
    input: inputType,
    inputPlaceholder: placeholder,
    showCancelButton: true,
    confirmButtonText: 'Submit',
    cancelButtonText: 'Cancel'
  })
}

export default Swal

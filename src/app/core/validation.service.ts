import { Injectable } from '@angular/core';
import { FormControl, Validators, ValidatorFn, AbstractControl, ValidationErrors } from '@angular/forms';

@Injectable({ providedIn: 'root' })
export class ValidationService {
  required(message = '此字段为必填项'): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const error = Validators.required(control);
      if (error) {
        return { required: { message } };
      }
      return null;
    };
  }

  min(min: number, message?: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const error = Validators.min(min)(control);
      if (error) {
        return { min: { message: message || `最小值为 ${min}`, min } };
      }
      return null;
    };
  }

  max(max: number, message?: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const error = Validators.max(max)(control);
      if (error) {
        return { max: { message: message || `最大值为 ${max}`, max } };
      }
      return null;
    };
  }

  minLength(minLength: number, message?: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const error = Validators.minLength(minLength)(control);
      if (error) {
        return { minlength: { message: message || `最少 ${minLength} 个字符`, requiredLength: minLength } };
      }
      return null;
    };
  }

  positiveNumber(message = '必须是正数'): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (value === null || value === undefined || value === '') return null;
      const num = Number(value);
      if (isNaN(num) || num <= 0) {
        return { positiveNumber: { message } };
      }
      return null;
    };
  }

  uniqueId(existingIds: string[], currentId?: string, message = '此ID已存在'): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (!value) return null;
      if (currentId && value === currentId) return null;
      if (existingIds.includes(value)) {
        return { uniqueId: { message, existingIds } };
      }
      return null;
    };
  }

  getErrorMessage(control: AbstractControl): string {
    if (!control.errors || !control.touched) return '';

    for (const key of Object.keys(control.errors)) {
      const error = control.errors[key];
      if (error?.message) {
        return error.message;
      }
      if (key === 'required') return '此字段为必填项';
      if (key === 'min') return `最小值为 ${error.min}`;
      if (key === 'max') return `最大值为 ${error.max}`;
      if (key === 'minlength') return `最少 ${error.requiredLength} 个字符`;
      if (key === 'email') return '请输入有效的邮箱';
      if (key === 'pattern') return '格式不正确';
    }
    return '输入无效';
  }

  validateAll(form: { [key: string]: AbstractControl }): boolean {
    let isValid = true;
    Object.values(form).forEach(control => {
      control.markAsTouched();
      control.updateValueAndValidity();
      if (control.invalid) isValid = false;
    });
    return isValid;
  }
}

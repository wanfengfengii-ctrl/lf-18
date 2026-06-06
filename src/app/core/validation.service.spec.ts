import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { ValidationService } from './validation.service';

describe('ValidationService', () => {
  let service: ValidationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ValidationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('required', () => {
    it('should return null for non-empty value', () => {
      const control = new FormControl('test');
      const result = service.required()(control);
      expect(result).toBeNull();
    });

    it('should return error for empty value', () => {
      const control = new FormControl('');
      const result = service.required()(control);
      expect(result).toBeTruthy();
      expect(result?.['required']?.message).toBe('此字段为必填项');
    });

    it('should use custom message', () => {
      const control = new FormControl('');
      const result = service.required('请输入名称')(control);
      expect(result?.['required']?.message).toBe('请输入名称');
    });
  });

  describe('min', () => {
    it('should return null for value >= min', () => {
      const control = new FormControl(10);
      const result = service.min(5)(control);
      expect(result).toBeNull();
    });

    it('should return error for value < min', () => {
      const control = new FormControl(3);
      const result = service.min(5)(control);
      expect(result).toBeTruthy();
      expect(result?.['min']?.min).toBe(5);
    });
  });

  describe('positiveNumber', () => {
    it('should return null for positive number', () => {
      const control = new FormControl(5);
      const result = service.positiveNumber()(control);
      expect(result).toBeNull();
    });

    it('should return error for zero', () => {
      const control = new FormControl(0);
      const result = service.positiveNumber()(control);
      expect(result).toBeTruthy();
    });

    it('should return error for negative number', () => {
      const control = new FormControl(-5);
      const result = service.positiveNumber()(control);
      expect(result).toBeTruthy();
    });

    it('should return error for non-numeric value', () => {
      const control = new FormControl('abc');
      const result = service.positiveNumber()(control);
      expect(result).toBeTruthy();
    });
  });

  describe('uniqueId', () => {
    it('should return null for unique id', () => {
      const control = new FormControl('new-id');
      const result = service.uniqueId(['id1', 'id2'])(control);
      expect(result).toBeNull();
    });

    it('should return error for duplicate id', () => {
      const control = new FormControl('id1');
      const result = service.uniqueId(['id1', 'id2'])(control);
      expect(result).toBeTruthy();
    });

    it('should return null for current id', () => {
      const control = new FormControl('id1');
      const result = service.uniqueId(['id1', 'id2'], 'id1')(control);
      expect(result).toBeNull();
    });
  });

  describe('getErrorMessage', () => {
    it('should return empty string for valid control', () => {
      const control = new FormControl('test');
      expect(service.getErrorMessage(control)).toBe('');
    });

    it('should return empty string for untouched control with errors', () => {
      const control = new FormControl('', service.required());
      expect(service.getErrorMessage(control)).toBe('');
    });

    it('should return error message for touched invalid control', () => {
      const control = new FormControl('', service.required());
      control.markAsTouched();
      expect(service.getErrorMessage(control)).toBe('此字段为必填项');
    });
  });

  describe('validateAll', () => {
    it('should return true for all valid controls', () => {
      const form = new FormGroup({
        name: new FormControl('test', service.required()),
        age: new FormControl(25, service.min(0))
      });
      expect(service.validateAll(form.controls)).toBe(true);
    });

    it('should return false if any control is invalid', () => {
      const form = new FormGroup({
        name: new FormControl('', service.required()),
        age: new FormControl(25)
      });
      expect(service.validateAll(form.controls)).toBe(false);
    });

    it('should mark all controls as touched', () => {
      const form = new FormGroup({
        name: new FormControl(''),
        age: new FormControl('')
      });
      service.validateAll(form.controls);
      expect(form.get('name')?.touched).toBe(true);
      expect(form.get('age')?.touched).toBe(true);
    });
  });
});

import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let snackBarSpy: jasmine.SpyObj<MatSnackBar>;

  beforeEach(() => {
    const spy = jasmine.createSpyObj('MatSnackBar', ['open']);

    TestBed.configureTestingModule({
      imports: [NoopAnimationsModule],
      providers: [
        NotificationService,
        { provide: MatSnackBar, useValue: spy }
      ]
    });

    service = TestBed.inject(NotificationService);
    snackBarSpy = TestBed.inject(MatSnackBar) as jasmine.SpyObj<MatSnackBar>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should show success message', () => {
    service.success('操作成功');
    expect(snackBarSpy.open).toHaveBeenCalled();
    const args = snackBarSpy.open.calls.mostRecent().args;
    expect(args[0]).toBe('操作成功');
  });

  it('should show error message', () => {
    service.error('操作失败');
    expect(snackBarSpy.open).toHaveBeenCalled();
    const args = snackBarSpy.open.calls.mostRecent().args;
    expect(args[0]).toBe('操作失败');
  });

  it('should show warning message', () => {
    service.warning('警告信息');
    expect(snackBarSpy.open).toHaveBeenCalled();
    const args = snackBarSpy.open.calls.mostRecent().args;
    expect(args[0]).toBe('警告信息');
  });

  it('should show info message', () => {
    service.info('提示信息');
    expect(snackBarSpy.open).toHaveBeenCalled();
    const args = snackBarSpy.open.calls.mostRecent().args;
    expect(args[0]).toBe('提示信息');
  });

  it('should pass action to snackbar', () => {
    service.success('操作成功', '关闭');
    expect(snackBarSpy.open).toHaveBeenCalled();
    const args = snackBarSpy.open.calls.mostRecent().args;
    expect(args[1]).toBe('关闭');
  });
});

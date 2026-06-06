import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly defaultDuration = 3000;
  private readonly defaultHorizontalPosition: 'center' = 'center';
  private readonly defaultVerticalPosition: 'bottom' = 'bottom';

  constructor(private snackBar: MatSnackBar) {}

  success(message: string, action: string = '关闭'): void {
    this.snackBar.open(message, action, {
      duration: this.defaultDuration,
      horizontalPosition: this.defaultHorizontalPosition,
      verticalPosition: this.defaultVerticalPosition,
      panelClass: ['snackbar-success']
    });
  }

  error(message: string, action: string = '关闭'): void {
    this.snackBar.open(message, action, {
      duration: this.defaultDuration,
      horizontalPosition: this.defaultHorizontalPosition,
      verticalPosition: this.defaultVerticalPosition,
      panelClass: ['snackbar-error']
    });
  }

  warning(message: string, action: string = '关闭'): void {
    this.snackBar.open(message, action, {
      duration: this.defaultDuration,
      horizontalPosition: this.defaultHorizontalPosition,
      verticalPosition: this.defaultVerticalPosition,
      panelClass: ['snackbar-warning']
    });
  }

  info(message: string, action: string = '关闭'): void {
    this.snackBar.open(message, action, {
      duration: this.defaultDuration,
      horizontalPosition: this.defaultHorizontalPosition,
      verticalPosition: this.defaultVerticalPosition,
      panelClass: ['snackbar-info']
    });
  }
}

import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { DeviceItem, initials } from './device-item';

describe('initials', () => {
  it('takes the first letters of up to three words', () => {
    expect(initials('Host Hub')).toBe('HH');
    expect(initials('Linux build server')).toBe('LBS');
    expect(initials('my-old_living room pi')).toBe('MOL');
  });

  it('takes the first two letters of a single word', () => {
    expect(initials('Printer')).toBe('PR');
    expect(initials('pi')).toBe('PI');
  });

  it('keeps letters made of two code units whole', () => {
    expect(initials('𝔸lpha 𝔹eta')).toBe('𝔸𝔹');
  });

  it('is empty for an empty name', () => {
    expect(initials('')).toBe('');
  });
});

describe('DeviceItem', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('tells that a device waits for its pairing code instead of that it does not answer', () => {
    const fixture = TestBed.createComponent(DeviceItem);
    fixture.componentRef.setInput('device', {
      id: 'nas',
      name: 'NAS',
      unreachable: true,
      unreachableSince: 1_700_000_000,
      pairing: 'needed',
    });
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button.title).toBe('Waits for its pairing code');
    expect(button.querySelector('.detail')?.textContent?.trim()).toBe('Waits for its pairing code');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImageUploadEditor, renderCroppedWebp } from './ImageUploadEditor';
import * as apiModule from '@/lib/api';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    uploadMedia: vi.fn(),
  };
});

function createMockCanvasContext() {
  return {
    fillStyle: '',
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

describe('ImageUploadEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (!URL.createObjectURL) {
      URL.createObjectURL = vi.fn(() => 'blob:mock-preview');
    } else {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-preview');
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = vi.fn();
    } else {
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    }
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders placeholder when empty and core image controls', () => {
    render(
      <ImageUploadEditor
        value={{ url: '' }}
        onChange={vi.fn()}
        endpoint="/upload/avatar"
        label="Profile photo"
      />,
    );

    expect(screen.getByText('Profile photo')).toBeInTheDocument();
    expect(screen.getByText(/upload an image/i)).toBeInTheDocument();

    const fileInput = screen.getByLabelText(/choose image file/i) as HTMLInputElement;
    expect(fileInput.type).toBe('file');
    expect(fileInput.accept).toBe('image/webp,image/png,image/jpeg');

    expect(screen.queryByLabelText('Image URL')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Zoom image')).toBeInTheDocument();
    expect(screen.getByLabelText('Rotate 90 degrees')).toBeInTheDocument();
    expect(screen.getByLabelText('Fine rotation')).toBeInTheDocument();
    expect(screen.getByLabelText('Reset position')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '16:9' })).not.toBeInTheDocument();
  });

  it('invokes onChange when adjusting zoom, rotating 90 degrees, and resetting', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    const { rerender } = render(
      <ImageUploadEditor
        value={{ url: 'https://cdn.csui.dev/avatar.webp' }}
        onChange={onChange}
        endpoint="/upload/avatar"
      />,
    );

    fireEvent.change(screen.getByLabelText('Zoom image'), { target: { value: '1.8' } });
    expect(onChange).toHaveBeenLastCalledWith({
      url: 'https://cdn.csui.dev/avatar.webp',
      config: { x: 50, y: 50, zoom: 1.8, rotate: 0, aspect: '1:1' },
    });

    rerender(
      <ImageUploadEditor
        value={{
          url: 'https://cdn.csui.dev/avatar.webp',
          config: { x: 25, y: 40, zoom: 1.8, rotate: 270, aspect: '1:1' },
        }}
        onChange={onChange}
        endpoint="/upload/avatar"
      />,
    );

    await user.click(screen.getByLabelText('Rotate 90 degrees'));
    expect(onChange).toHaveBeenLastCalledWith({
      url: 'https://cdn.csui.dev/avatar.webp',
      config: { x: 25, y: 40, zoom: 1.8, rotate: 0, aspect: '1:1' },
    });

    await user.click(screen.getByLabelText('Reset position'));
    expect(onChange).toHaveBeenLastCalledWith({
      url: 'https://cdn.csui.dev/avatar.webp',
      config: { x: 50, y: 50, zoom: 1, rotate: 0, aspect: '1:1' },
    });
  });

  it('locks aspect ratio to 1:1 and updates x/y when dragging the preview', () => {
    const onChange = vi.fn();

    render(
      <ImageUploadEditor
        value={{
          url: '/api/v1/media/achievements/banner.webp',
          config: { x: 50, y: 50, zoom: 1.5, rotate: 0, aspect: '16:9' },
        }}
        onChange={onChange}
        endpoint="/upload/achievement"
      />,
    );

    expect(screen.queryByRole('button', { name: '4:3' })).not.toBeInTheDocument();
    const preview = screen.getByAltText('Crop preview').parentElement as HTMLElement;
    expect(preview.style.aspectRatio).toBe('1 / 1');

    vi.spyOn(preview, 'getBoundingClientRect').mockReturnValue({
      width: 200,
      height: 200,
      top: 0,
      left: 0,
      right: 200,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(preview, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(preview, { pointerId: 1, clientX: 120, clientY: 80 });
    fireEvent.pointerUp(preview, { pointerId: 1 });

    expect(onChange).toHaveBeenLastCalledWith({
      url: '/api/v1/media/achievements/banner.webp',
      config: { x: 40, y: 60, zoom: 1.5, rotate: 0, aspect: '1:1' },
    });
  });

  it('renders cropped WebP and uploads file on Apply & upload', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const ctx = createMockCanvasContext();
    const expectedBlob = new Blob(['webp-bytes'], { type: 'image/webp' });

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => {
      cb(expectedBlob);
    });

    vi.mocked(apiModule.uploadMedia).mockResolvedValue({
      url: '/api/v1/media/achievements/42.webp',
      key: 'achievements/42.webp',
      width: 1200,
      height: 1200,
      mime: 'image/webp',
      size: expectedBlob.size,
    });

    render(
      <ImageUploadEditor
        value={{ url: '' }}
        onChange={onChange}
        endpoint="/upload/achievement"
        uploadParams={{ slug: 'icpc-2025' }}
      />,
    );

    const file = new File(['png-data'], 'photo.png', { type: 'image/png' });
    const fileInput = screen.getByLabelText(/choose image file/i) as HTMLInputElement;
    await user.upload(fileInput, file);

    const img = screen.getByAltText('Crop preview') as HTMLImageElement;
    Object.defineProperty(img, 'complete', { value: true, configurable: true });
    Object.defineProperty(img, 'naturalWidth', { value: 1920, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: 1080, configurable: true });

    await user.click(screen.getByRole('button', { name: /apply & upload/i }));

    await waitFor(() => {
      expect(apiModule.uploadMedia).toHaveBeenCalledWith(
        '/upload/achievement',
        expectedBlob,
        { slug: 'icpc-2025' },
      );
    });

    expect(onChange).toHaveBeenLastCalledWith({
      url: '/api/v1/media/achievements/42.webp',
      config: { x: 50, y: 50, zoom: 1, rotate: 0, aspect: '1:1' },
    });
  });

  it('calls onCommit directly after Apply & upload succeeds', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onCommit = vi.fn().mockResolvedValue(undefined);
    const ctx = createMockCanvasContext();
    const expectedBlob = new Blob(['webp-bytes'], { type: 'image/webp' });

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => {
      cb(expectedBlob);
    });

    vi.mocked(apiModule.uploadMedia).mockResolvedValue({
      url: 'http://localhost:9000/zenith-media/members/2606888572-1.webp',
      key: 'members/2606888572-1.webp',
      width: 800,
      height: 800,
      mime: 'image/webp',
      size: expectedBlob.size,
    });

    render(
      <ImageUploadEditor
        value={{ url: '' }}
        onChange={onChange}
        onCommit={onCommit}
        endpoint="/upload/avatar"
      />,
    );

    const file = new File(['png-data'], 'avatar.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText(/choose image file/i), file);

    const img = screen.getByAltText('Crop preview') as HTMLImageElement;
    Object.defineProperty(img, 'complete', { value: true, configurable: true });
    Object.defineProperty(img, 'naturalWidth', { value: 1000, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: 1000, configurable: true });

    await user.click(screen.getByRole('button', { name: /apply & upload/i }));

    const expectedNext = {
      url: 'http://localhost:9000/zenith-media/members/2606888572-1.webp',
      config: { x: 50, y: 50, zoom: 1, rotate: 0, aspect: '1:1' },
    };

    await waitFor(() => {
      expect(onCommit).toHaveBeenCalledWith(expectedNext);
    });
    expect(onChange).toHaveBeenLastCalledWith(expectedNext);
  });

  it('commits position/zoom edits directly via Save photo when onCommit is provided', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onCommit = vi.fn().mockResolvedValue(undefined);

    const { rerender } = render(
      <ImageUploadEditor
        value={{ url: '/api/v1/media/members/old.webp' }}
        onChange={onChange}
        onCommit={onCommit}
        endpoint="/upload/avatar"
      />,
    );

    expect(screen.queryByRole('button', { name: /save photo/i })).toBeNull();

    fireEvent.change(screen.getByLabelText('Zoom image'), {
      target: { value: '1.5' },
    });

    rerender(
      <ImageUploadEditor
        value={{
          url: '/api/v1/media/members/old.webp',
          config: { x: 50, y: 50, zoom: 1.5, rotate: 0, aspect: '1:1' },
        }}
        onChange={onChange}
        onCommit={onCommit}
        endpoint="/upload/avatar"
      />,
    );

    await user.click(screen.getByRole('button', { name: /save photo/i }));

    await waitFor(() => {
      expect(onCommit).toHaveBeenCalledWith({
        url: '/api/v1/media/members/old.webp',
        config: { x: 50, y: 50, zoom: 1.5, rotate: 0, aspect: '1:1' },
      });
    });

    expect(screen.queryByRole('button', { name: /save photo/i })).toBeNull();
  });
});

describe('renderCroppedWebp', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('draws 16:9 at 1600x900 and steps down quality when WebP exceeds 2 MB', async () => {
    const ctx = createMockCanvasContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);

    const qualities: number[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb, _mime, q) => {
      const quality = typeof q === 'number' ? q : 0.82;
      qualities.push(quality);
      const size = quality > 0.75 ? 2_500_000 : 180_000;
      const blob = new Blob([new Uint8Array(4)], { type: 'image/webp' });
      Object.defineProperty(blob, 'size', { value: size });
      cb(blob);
    });

    const img = document.createElement('img');
    Object.defineProperty(img, 'naturalWidth', { value: 2400 });
    Object.defineProperty(img, 'naturalHeight', { value: 1600 });

    const blob = await renderCroppedWebp(img, {
      x: 50,
      y: 50,
      zoom: 1,
      rotate: 0,
      aspect: '16:9',
    });

    expect(qualities).toEqual([0.82, 0.7]);
    expect(blob.size).toBe(180_000);
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
  });
});

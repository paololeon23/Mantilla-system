"""Genera iconos PNG para PWA / iOS / Android desde el diseño Mantilla."""
from PIL import Image, ImageDraw

COLORS = {
    'top': (10, 24, 48),
    'mid': (15, 39, 68),
    'bot': (18, 58, 102),
    'white': (255, 255, 255),
    'wheel': (15, 39, 68),
}


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient_bg(size):
    img = Image.new('RGB', (size, size))
    px = img.load()
    for y in range(size):
        t = y / max(size - 1, 1)
        if t < 0.38:
            c = lerp(COLORS['top'], COLORS['mid'], t / 0.38)
        else:
            c = lerp(COLORS['mid'], COLORS['bot'], (t - 0.38) / 0.62)
        for x in range(size):
            px[x, y] = c
    return img


def rounded_mask(size, radius_ratio=0.2125):
    mask = Image.new('L', (size, size), 0)
    draw = ImageDraw.Draw(mask)
    r = int(size * radius_ratio)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=r, fill=255)
    return mask


def draw_truck(draw, size, inset=0.0):
    s = size * (1 - inset * 2)
    ox = size * inset
    oy = size * inset
    u = s / 80.0

    def X(x):
        return ox + x * u

    def Y(y):
        return oy + y * u

    # Caja
    draw.rounded_rectangle((X(17), Y(34), X(44), Y(50)), radius=2.5 * u, fill=COLORS['white'])
    # Cabina
    draw.polygon([
        (X(44), Y(37)), (X(53.5), Y(37)), (X(59), Y(42.2)), (X(59), Y(50)), (X(44), Y(50))
    ], fill=COLORS['white'])
    # Ventana
    draw.rounded_rectangle((X(19), Y(36), X(40), Y(46)), radius=1.5 * u, fill=(255, 255, 255, 56))
    # Ruedas
    for cx in (25.5, 49.5):
        draw.ellipse((X(cx - 4.2), Y(48.3), X(cx + 4.2), Y(56.7)), fill=COLORS['wheel'])
        draw.ellipse((X(cx - 2.1), Y(50.4), X(cx + 2.1), Y(54.6)), fill=COLORS['white'])


def make_icon(size, maskable=False):
    inset = 0.1 if maskable and size >= 192 else 0.0
    img = gradient_bg(size).convert('RGBA')
    mask = rounded_mask(size)
    img.putalpha(mask)
    draw = ImageDraw.Draw(img)
    draw_truck(draw, size, inset=inset)
    return img


def main():
    out = 'assets'
    pairs = [
        ('icon-192.png', 192, False),
        ('icon-512.png', 512, False),
        ('icon-512-maskable.png', 512, True),
        ('apple-touch-icon.png', 180, False),
    ]
    for name, size, maskable in pairs:
        path = f'{out}/{name}'
        make_icon(size, maskable=maskable).save(path, 'PNG', optimize=True)
        print('wrote', path)


if __name__ == '__main__':
    main()

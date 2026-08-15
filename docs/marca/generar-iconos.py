"""Deriva los iconos de la PWA del logo. De un solo uso: no es un paso de build."""

from PIL import Image

ORIGEN = "docs/marca/logo-circuitos-arg.png"
DESTINO = "apps/web/public"
FONDO = (28, 25, 23)  # #1c1917, el background_color del manifest


def encajar(logo: Image.Image, lado: int, ocupacion: float, fondo=None) -> Image.Image:
    """Logo centrado en un lienzo cuadrado, ocupando `ocupacion` del lado."""
    util = round(lado * ocupacion)
    escala = min(util / logo.width, util / logo.height)
    pieza = logo.resize((round(logo.width * escala), round(logo.height * escala)), Image.LANCZOS)
    lienzo = Image.new("RGBA", (lado, lado), (*fondo, 255) if fondo else (0, 0, 0, 0))
    lienzo.paste(pieza, ((lado - pieza.width) // 2, (lado - pieza.height) // 2), pieza)
    return lienzo


logo = Image.open(ORIGEN).convert("RGBA")
logo = logo.crop(logo.getbbox())  # el PNG trae margen transparente

salidas = [
    # nombre, lado, ocupación, fondo
    ("icon-192.png", 192, 0.96, None),
    ("icon-512.png", 512, 0.96, None),
    # maskable: Android recorta todo lo que sale de la safe zone del 80 % central
    ("icon-512-maskable.png", 512, 0.72, FONDO),
    # iOS no respeta el alfa: sin fondo propio la rellena de negro
    ("apple-touch-icon.png", 180, 0.92, FONDO),
    ("favicon.png", 48, 1.0, None),
]

for nombre, lado, ocupacion, fondo in salidas:
    img = encajar(logo, lado, ocupacion, fondo)
    if fondo:
        img = img.convert("RGB")
    # el logo es casi monocromo: una paleta de 128 lo deja igual y pesa 5 veces menos,
    # y estos PNG entran al precache del service worker
    img = img.quantize(colors=128, method=Image.FASTOCTREE)
    img.save(f"{DESTINO}/{nombre}", optimize=True)
    print(f"{nombre:26} {lado}x{lado}")

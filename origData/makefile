# Asset pipeline: rasterizes origData/icon.svg into the PNG sizes the
# PWA configuration in vite.config.js expects under public/.
#
#   logo192.png  -> manifest icon, 192x192
#   logo512.png  -> manifest icon, 512x512
#   favicon.png  -> browser-tab icon (linked from index.html)
#
# ImageMagick is used because it is available in this environment and
# renders this SVG correctly (the SVG deliberately avoids gradients,
# filters, and stroked open paths). Override RASTERIZE to point at a
# different ImageMagick-compatible binary if needed:
#
#   make RASTERIZE=convert

# Set shell to bash instead of sh allow for brace expansion
SHELL=/bin/bash

DEST=../public
SRC=.

RASTERIZE ?= magick

ICONS=$(DEST)/logo192.png $(DEST)/logo512.png
FAVICON=$(DEST)/favicon.png

.PHONY: default all clean

default: all ;

$(DEST)/logo192.png: $(SRC)/icon.svg
	$(RASTERIZE) -background none "$<" -resize 192x192 -depth 8 -strip "$@"

$(DEST)/logo512.png: $(SRC)/icon.svg
	$(RASTERIZE) -background none "$<" -resize 512x512 -depth 8 -strip "$@"

$(DEST)/favicon.png: $(SRC)/icon.svg
	$(RASTERIZE) -background none "$<" -resize 64x64 -depth 8 -strip "$@"

all: $(ICONS) $(FAVICON)

clean:
	rm -f $(ICONS) $(FAVICON)

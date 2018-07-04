GSCHEMAS_DIR := ./src/schemas
GSCHEMAS_COMPILED := $(GSCHEMAS_DIR)/gschemas.compiled
GSCHEMAS_SOURCE := $(shell find $(GSCHEMAS_DIR) -type f -name '*.xml')

.PHONY: gschema clean

$(GSCHEMAS_COMPILED): $(GSCHEMAS_SOURCE)
	glib-compile-schemas $(GSCHEMAS_DIR)

gschema: $(GSCHEMAS_COMPILED)

clean:
	rm -f $(GSCHEMAS_COMPILED)


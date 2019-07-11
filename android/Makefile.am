clean-local:
	rm -rf $(abs_top_srcdir)/android/lib/src/main/assets/*
	rm -rf app/build

all-local: lib/src/main/assets/templates/untitled.odg \
	   lib/src/main/assets/templates/untitled.odp \
	   lib/src/main/assets/templates/untitled.ods \
	   lib/src/main/assets/templates/untitled.odt

lib/src/main/assets/templates/untitled.%: templates/untitled.%
	@mkdir -p $(dir $@)
	@cp -a $< $@

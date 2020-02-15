clean-local:
	rm -rf $(abs_top_srcdir)/android/lib/src/main/assets/*
	rm -rf app/build

all-local: lib/src/main/assets/templates/untitled.odp \
	   lib/src/main/assets/templates/untitled.ods \
	   lib/src/main/assets/templates/untitled.odt \
	   lib/src/main/assets/etc/loolwsd/loolkitconfig.xcu

lib/src/main/assets/templates/untitled.%: templates/untitled.%
	@mkdir -p $(dir $@)
	@cp -a $< $@

lib/src/main/assets/etc/loolwsd/loolkitconfig.xcu: $(top_srcdir)/loolkitconfig-mobile.xcu
	@mkdir -p $(dir $@)
	@cp -a $< $@

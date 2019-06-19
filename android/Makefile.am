clean-local:
	rm -rf $(abs_top_srcdir)/android/app/src/main/assets/*

all-local: app/src/main/assets/templates/untitled.odg \
	   app/src/main/assets/templates/untitled.odp \
	   app/src/main/assets/templates/untitled.ods \
	   app/src/main/assets/templates/untitled.odt

app/src/main/assets/templates/untitled.%: templates/untitled.%
	@mkdir -p $(dir $@)
	@cp -a $< $@

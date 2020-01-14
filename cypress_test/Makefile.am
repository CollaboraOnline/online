CYPRESS_BINARY = ${top_srcdir}/cypress_test/node_modules/cypress/bin/cypress

DESKTOP_TEST_FOLDER = integration_tests/desktop
MOBILE_TEST_FOLDER = integration_tests/mobile
MOBILE_USER_AGENT = "cypress mobile test"

if HAVE_LO_PATH
check-local: @JAILS_PATH@
	@npm install
	@echo
	@pkill loolwsd || true
	@echo "Launching loolwsd for testing.."
	@fc-cache "@LO_PATH@"/share/fonts/truetype
	@cp $(top_srcdir)/test/data/hello.odt $(top_srcdir)/test/data/hello-world.odt
	@cp $(top_srcdir)/test/data/hello.ods $(top_srcdir)/test/data/hello-world.ods
	@cp $(top_srcdir)/test/data/hello.odp $(top_srcdir)/test/data/hello-world.odp
	@echo
	../loolwsd --o:sys_template_path="@SYSTEMPLATE_PATH@" \
			--o:child_root_path="@JAILS_PATH@" --o:storage.filesystem[@allow]=true \
			--o:ssl.cert_file_path="$(abs_top_srcdir)/etc/cert.pem" \
			--o:ssl.key_file_path="$(abs_top_srcdir)/etc/key.pem" \
			--o:ssl.ca_file_path="$(abs_top_srcdir)/etc/ca-chain.cert.pem" \
			--o:admin_console.username=admin --o:admin_console.password=admin \
			--o:logging.file[@enable]=true --o:logging.level=trace > /dev/null 2>&1 &
	@sleep 10
	@echo
	@echo "Running cypress desktop tests..."
	@echo
	$(CYPRESS_BINARY) run --browser chrome \
			--config integrationFolder=$(DESKTOP_TEST_FOLDER),video=false \
			--headless || \
			(pkill loolwsd && false)
	@echo
	@echo "Running cypress mobile tests..."
	@echo
	$(CYPRESS_BINARY) run --browser chrome \
			--config integrationFolder=$(MOBILE_TEST_FOLDER),video=false,userAgent=$(MOBILE_USER_AGENT) \
			--headless || \
			(pkill loolwsd && false)
	@pkill loolwsd || true
endif

clean-local:
	rm -rf node_modules
	rm -rf cypress

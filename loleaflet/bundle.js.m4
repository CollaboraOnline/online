m4_changequote([,])m4_dnl
m4_dnl# foreachq(x, `item_1, item_2, ..., item_n', stmt)
m4_dnl# quoted list, alternate improved version
m4_define([m4_foreachq],[m4_ifelse([$2],[],[],[m4_pushdef([$1])_$0([$1],[$3],[],$2)m4_popdef([$1])])])m4_dnl
m4_define([_m4_foreachq],[m4_ifelse([$#],[3],[],[m4_define([$1],[$4])$2[]$0([$1],[$2],m4_shift(m4_shift(m4_shift($@))))])])m4_dnl
m4_define([m4_trim],[m4_patsubst([$1],[^. ?\(.*\) .$])])m4_dnl
m4_dnl
m4_dnl files for IOS
m4_ifelse(m4_trim(L10N_IOS_ALL_JS),[],[],[m4_syscmd([cat ]L10N_IOS_ALL_JS)])

m4_dnl node_modules
m4_foreachq([fileNode],[NODE_MODULES_JS],[
m4_syscmd([cat ]fileNode)
])

m4_dnl imported libraries
m4_foreachq([fileLib],[LOLEAFLET_LIBS_JS],[
m4_syscmd([cat ]fileLib)
])

m4_dnl bundled loleaflet
m4_syscmd([cat ]LOLEAFLET_JS)

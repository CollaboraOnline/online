#!/bin/sh

for i in ab af am an ar as ast az be bg bn bn_IN bo br brx bs ca cs cy da de dgo dsb dz el en_GB en_ZA eo es et eu fa fi fr ga gd gl gu gug he hi hr hsb hu id is it ja jv ka kk kl km kn ko kok ks ky lb lo lt lv mai mk ml mn mni mr my nb ne nl nn nr nso oc om or pa_IN pl pt pt_BR ro ru rw sah sa_IN sat sd si sid sk sl sq sr ss st sv sw_TZ ta te tg th ti tn tr ts tt ug uk ur uz ve vec vi xh zh_CN zh_TW zu;
do
    wget --prefer-family=IPv4 -O $i.zip https://translations.documentfoundation.org/export/?path=/$i/libo_online/
    unzip -j $i.zip
    rm $i.zip
    mv loleaflet-ui-$i.po ui-$i.po
    mv loleaflet-help-$i.po help-$i.po
done

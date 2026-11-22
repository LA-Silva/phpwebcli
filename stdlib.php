



echo "        CCCCCCCCCCCCCYYYYYYY       YYYYYYYBBBBBBBBBBBBBBBBB   EEEEEEEEEEEEEEEEEEEEEERRRRRRRRRRRRRRRRR   \n";
echo "     CCC::::::::::::CY:::::Y       Y:::::YB::::::::::::::::B  E::::::::::::::::::::ER::::::::::::::::R  \n";
echo "   CC:::::::::::::::CY:::::Y       Y:::::YB::::::BBBBBB:::::B E::::::::::::::::::::ER::::::RRRRRR:::::R \n";
echo "  C:::::CCCCCCCC::::CY::::::Y     Y::::::YBB:::::B     B:::::BEE::::::EEEEEEEEE::::ERR:::::R     R:::::R\n";
echo " C:::::C       CCCCCCYYY:::::Y   Y:::::YYY  B::::B     B:::::B  E:::::E       EEEEEE  R::::R     R:::::R\n";
echo "C:::::C                 Y:::::Y Y:::::Y     B::::B     B:::::B  E:::::E               R::::R     R:::::R\n";
echo "C:::::C                  Y:::::Y:::::Y      B::::BBBBBB:::::B   E::::::EEEEEEEEEE     R::::RRRRRR:::::R \n";
echo "C:::::C                   Y:::::::::Y       B:::::::::::::BB    E:::::::::::::::E     R:::::::::::::RR  \n";
echo "C:::::C                    Y:::::::Y        B::::BBBBBB:::::B   E:::::::::::::::E     R::::RRRRRR:::::R \n";
echo "C:::::C                     Y:::::Y         B::::B     B:::::B  E::::::EEEEEEEEEE     R::::R     R:::::R\n";
echo "C:::::C                     Y:::::Y         B::::B     B:::::B  E:::::E               R::::R     R:::::R\n";
echo " C:::::C       CCCCCC       Y:::::Y         B::::B     B:::::B  E:::::E       EEEEEE  R::::R     R:::::R\n";
echo "  C:::::CCCCCCCC::::C       Y:::::Y       BB:::::BBBBBB::::::BEE::::::EEEEEEEE:::::ERR:::::R     R:::::R\n";
echo "   CC:::::::::::::::C    YYYY:::::YYYY    B:::::::::::::::::B E::::::::::::::::::::ER::::::R     R:::::R\n";
echo "     CCC::::::::::::C    Y:::::::::::Y    B::::::::::::::::B  E::::::::::::::::::::ER::::::R     R:::::R\n";
echo "        CCCCCCCCCCCCC    YYYYYYYYYYYYY    BBBBBBBBBBBBBBBBB   EEEEEEEEEEEEEEEEEEEEEERRRRRRRR     RRRRRRR\n";
echo " \n";
echo "VVVVVVVV           VVVVVVVVPPPPPPPPPPPPPPPPP      SSSSSSSSSSSSSSS \n";
echo "V::::::V           V::::::VP::::::::::::::::P   SS:::::::::::::::S\n";
echo "V::::::V           V::::::VP::::::PPPPPP:::::P S:::::SSSSSS::::::S\n";
echo "V::::::V           V::::::VPP:::::P     P:::::PS:::::S     SSSSSSS\n";
echo " V:::::V           V:::::V   P::::P     P:::::PS:::::S            \n";
echo "  V:::::V         V:::::V    P::::P     P:::::PS:::::S            \n";
echo "   V:::::V       V:::::V     P::::PPPPPP:::::P  S::::SSSS         \n";
echo "    V:::::V     V:::::V      P:::::::::::::PP    SS::::::SSSSS    \n";
echo "     V:::::V   V:::::V       P::::PPPPPPPPP        SSS::::::::SS  \n";
echo "      V:::::V V:::::V        P::::P                   SSSSSS::::S \n";
echo "       V:::::V:::::V         P::::P                        S:::::S\n";
echo "        V:::::::::V          P::::P                        S:::::S\n";
echo "         V:::::::V         PP::::::PP          SSSSSSS     S:::::S\n";
echo "          V:::::V          P::::::::P          S::::::SSSSSS:::::S\n";
echo "           V:::V           P::::::::P          S:::::::::::::::SS \n";
echo "            VVV            PPPPPPPPPP           SSSSSSSSSSSSSSS   \n";

function myinput($arg1, $secret = false) {
	global $io;
	return $io->read($arg1, $secret);
}


unit_test(true);
dates_unit_test(true);
cron_unit_test(true);
files_unit_test(true);
math_unit_test(true);
arrays_unit_test(true);
sqlite_unit_test(true);

$loginname = myinput("Login:");
echo "hello " . $loginname . "\n";

$passwd = myinput("password:",true);
echo "you password was:" . $passwd;

//$io->readline("Login: ", function($s) use ($term) { $term->echo("ok"); }, false);
//$io->readline("Password: ", function($s) use ($term) { $term->echo("ok"); }, true);

//$passwd = myinput("password:");
//$jQuery('body')->terminal()->set_mask("*");
//$loginname= myinput("login:");











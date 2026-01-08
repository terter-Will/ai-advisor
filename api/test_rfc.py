from pyrfc import Connection

conn = Connection(
    ashost="172.16.188.213",   # USRINFO.sapaddr
    sysnr="10",          # USRINFO.sapins（兩碼）
    client="666",        # USRINFO.sapclnt（三碼）
    user="will.cheng",     # USRINFO.sapusr
    passwd="1qaz@WSX",   # USRINFO.sappw
    # saprouter="/H/1.2.3.4/S/3299/W/xxx"  # 有用再加
)
print("PING:", conn.call("RFC_PING"))  # 應該印 PING: {}
conn.close()
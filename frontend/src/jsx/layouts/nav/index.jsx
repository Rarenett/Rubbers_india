import React, { Fragment, useState } from "react";
import SideBar from "./SideBar";
import NavHader from "./NavHader";
import Header from "./Header";
import ChatBox from "../ChatBox";
import ResponsibilityReminderPopup from "../../components/HR/Masters/ResponsibilityReminderPopup";
import ComplaintReminderPopup from "../../components/Complaints/ComplaintReminderPopup";

const FastoNav = ({ title, onClick: ClickToAddEvent, onClick2, onClick3 }) => {
  const [toggle, setToggle] = useState("");
  const onClick = (name) => setToggle(toggle === name ? "" : name);
  return (
    <Fragment>
      <NavHader />
      <ChatBox onClick={() => onClick("chatbox")} toggle={toggle} />
      <Header
        onNote={() => onClick("chatbox")}
        onNotification={() => onClick("notification")}
        onProfile={() => onClick("profile")}
        onChatbot={() => onClick("chatbot")}
        toggle={toggle}
        title={title}
        onBox={() => onClick("box")}
        onClick={() => ClickToAddEvent()}
      />

      <SideBar />
      <ResponsibilityReminderPopup />
      <ComplaintReminderPopup />
    </Fragment>
  );
};

export default FastoNav;

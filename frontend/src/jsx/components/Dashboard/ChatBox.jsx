import React, { Component } from 'react';
import PropTypes from 'prop-types';
//import ChatBot from 'react-simple-chatbot';
//import {ChatBox} from 'react-chatbox-component';
import ChatRoom from '../Fasto/Chatbox/ChatRoom';
 
/* const messages = [
	{
		"text": "Hello there",
		"id": "1",
		"sender": {
		  "name": "Ironman",
		  "uid": "user1",
		  "avatar": "https://data.cometchat.com/assets/images/avatars/ironman.png",
		},
	},
	{
		"text": "How are you",
		"id": "2",
		"sender": {
		  "name": "Salman",
		  "uid": "user2",
		  "avatar": "https://data.cometchat.com/assets/images/avatars/ironman.png",
		},
	},
] 
 
const user = {
  "uid" : "user1"
}*/



class Review extends Component {
  constructor(props) {
    super(props);

    this.state = {
      name: '',
      gender: '',
      age: '',
    };
  }

  componentWillMount() {
    const { steps } = this.props;
    const { name, gender, age } = steps;

    this.setState({ name, gender, age });
  }

  render() {
    const { name, gender, age } = this.state;
    return (
      <div style={{ width: '100%' }}>
        <h3>Summary</h3>
        <table>
          <tbody>
            <tr>
              <td>Name</td>
              <td>{name.value}</td>
            </tr>
            <tr>
              <td>Gender</td>
              <td>{gender.value}</td>
            </tr>
            <tr>
              <td>Age</td>
              <td>{age.value}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
}

Review.propTypes = {
  steps: PropTypes.object,
};

Review.defaultProps = {
  steps: undefined,
};

class ChatBox1 extends Component {
	render() {
		return (
			<>				
				<div className="row">
					<div className="col-xl-6">
						<ChatRoom />
					</div>
				</div>
			</>	
		);
	}
}

export default ChatBox1;